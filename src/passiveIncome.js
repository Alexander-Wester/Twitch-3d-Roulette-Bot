const {
    changeBalance
} = require("./database");


// ----------------------------------------------------
// Passive income settings
// ----------------------------------------------------

const PASSIVE_INCOME_AMOUNT = 200;
const PASSIVE_INCOME_INTERVAL_MS = 5 * 60 * 1000;

let passiveIncomeTimer = null;
let passiveIncomeCheckRunning = false;


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
//
// getAccessToken() is supported so a long-running bot always
// uses the newest automatically-refreshed Twitch access token.
// ----------------------------------------------------

async function awardPassiveIncome(options) {
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
            throw new Error("No Twitch access token is available for passive income.");
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
                PASSIVE_INCOME_AMOUNT
            );

            paidCount++;
        }

        console.log(
            `[Passive Income] +${PASSIVE_INCOME_AMOUNT} chips -> ` +
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


// ----------------------------------------------------
// Start passive income.
// ----------------------------------------------------

function startPassiveIncome(options) {
    if (passiveIncomeTimer) {
        clearInterval(passiveIncomeTimer);
    }

    console.log(
        `[Passive Income] Enabled: +${PASSIVE_INCOME_AMOUNT} chips ` +
        `every ${PASSIVE_INCOME_INTERVAL_MS / 60000} minutes in chat.`
    );

    passiveIncomeTimer = setInterval(
        () => {
            awardPassiveIncome(options);
        },
        PASSIVE_INCOME_INTERVAL_MS
    );

    passiveIncomeTimer.unref?.();

    return passiveIncomeTimer;
}


module.exports = {
    startPassiveIncome,
    awardPassiveIncome,
    getCurrentChatters,
    PASSIVE_INCOME_AMOUNT,
    PASSIVE_INCOME_INTERVAL_MS
};
