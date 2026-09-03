const {
    changeBalance
} = require("./database");

const {
    getSettings,
    onSettingsChanged
} = require("./settings");


let passiveIncomeTimer = null;
let passiveIncomeCheckRunning = false;
let passiveIncomeOptions = null;
let unsubscribeSettings = null;


async function resolveAccessToken(options) {
    if (typeof options.getAccessToken === "function") {
        return options.getAccessToken();
    }

    return options.accessToken;
}


// ----------------------------------------------------
// Get every Twitch user currently connected to chat.
// ----------------------------------------------------

async function getCurrentChatters({
    accessToken,
    clientId,
    broadcasterUserId,
    moderatorUserId
}) {
    const chatters = [];
    let cursor = null;

    do {
        const params = new URLSearchParams({
            broadcaster_id: broadcasterUserId,
            moderator_id: moderatorUserId,
            first: "1000"
        });

        if (cursor) {
            params.set("after", cursor);
        }

        const response = await fetch(
            `https://api.twitch.tv/helix/chat/chatters?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Client-Id": clientId
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const twitchMessage =
                data?.message ||
                JSON.stringify(data);

            throw new Error(
                `Could not get Twitch chatters (${response.status}): ` +
                twitchMessage
            );
        }

        if (Array.isArray(data.data)) {
            chatters.push(...data.data);
        }

        cursor =
            data.pagination?.cursor ||
            null;

    } while (cursor);

    return chatters;
}


// ----------------------------------------------------
// Award one passive-income tick.
// ----------------------------------------------------

async function awardPassiveIncome(options) {
    const settings = getSettings();

    if (!settings.passiveIncomeEnabled) {
        return;
    }

    if (passiveIncomeCheckRunning) {
        console.warn(
            "Skipping passive income tick because the previous check is still running."
        );

        return;
    }

    passiveIncomeCheckRunning = true;

    try {
        const accessToken =
            await resolveAccessToken(options);

        if (!accessToken) {
            throw new Error(
                "No Twitch access token is available for passive income."
            );
        }

        const chatters =
            await getCurrentChatters({
                accessToken,
                clientId: options.clientId,
                broadcasterUserId: options.broadcasterUserId,
                moderatorUserId: options.botUserId
            });

        let paidCount = 0;

        for (const chatter of chatters) {
            if (chatter.user_id === options.botUserId) {
                continue;
            }

            changeBalance(
                chatter.user_id,
                chatter.user_name,
                settings.passiveIncomeAmount
            );

            paidCount++;
        }

        console.log(
            `[Passive Income] +${settings.passiveIncomeAmount} chips -> ` +
            `${paidCount} chatter${paidCount === 1 ? "" : "s"}.`
        );

    } catch (error) {
        console.error(
            "[Passive Income] Award failed:",
            error.message
        );

        if (
            error.message.includes("401") ||
            error.message.includes("403")
        ) {
            console.error(
                "[Passive Income] The bot token needs the " +
                "moderator:read:chatters scope, and the bot account " +
                "must be a moderator in the channel."
            );
        }
    } finally {
        passiveIncomeCheckRunning = false;
    }
}


function configurePassiveIncomeTimer() {
    if (passiveIncomeTimer) {
        clearInterval(passiveIncomeTimer);
        passiveIncomeTimer = null;
    }

    if (!passiveIncomeOptions) {
        return;
    }

    const settings = getSettings();

    if (!settings.passiveIncomeEnabled) {
        console.log(
            "[Passive Income] Disabled in settings."
        );
        return;
    }

    const intervalMs =
        settings.passiveIncomeMinutes * 60 * 1000;

    console.log(
        `[Passive Income] Enabled: +${settings.passiveIncomeAmount} chips ` +
        `every ${settings.passiveIncomeMinutes} minutes in chat.`
    );

    passiveIncomeTimer = setInterval(
        () => {
            awardPassiveIncome(
                passiveIncomeOptions
            );
        },
        intervalMs
    );

    passiveIncomeTimer.unref?.();
}


// ----------------------------------------------------
// Start passive income and keep its timer synchronized
// with Settings-page changes.
// ----------------------------------------------------

function startPassiveIncome(options) {
    passiveIncomeOptions = options;

    unsubscribeSettings?.();

    unsubscribeSettings =
        onSettingsChanged(
            (_settings, changedKeys) => {
                if (
                    changedKeys.some(key => [
                        "passiveIncomeEnabled",
                        "passiveIncomeAmount",
                        "passiveIncomeMinutes"
                    ].includes(key))
                ) {
                    configurePassiveIncomeTimer();
                }
            }
        );

    configurePassiveIncomeTimer();

    return passiveIncomeTimer;
}


module.exports = {
    startPassiveIncome,
    awardPassiveIncome,
    getCurrentChatters
};
