const {
    changeBalance
} = require("./database");


// ----------------------------------------------------
// Passive income settings
//
// Easy to change later if you want to rebalance it.
// ----------------------------------------------------

const PASSIVE_INCOME_AMOUNT = 200;
const PASSIVE_INCOME_INTERVAL_MS = 5 * 60 * 1000;

let passiveIncomeTimer = null;
let passiveIncomeCheckRunning = false;


// ----------------------------------------------------
// Get every Twitch user currently connected to chat.
//
// Twitch paginates this endpoint, so keep following the
// cursor until every chatter has been collected.
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
// Award one five-minute passive-income tick.
//
// changeBalance() already calls getOrCreateUser().
// Therefore a brand-new chatter is first created with
// the normal 1,000-chip starting balance, then receives
// this 200-chip watch-time payment.
// ----------------------------------------------------

async function awardPassiveIncome({
    accessToken,
    clientId,
    broadcasterUserId,
    botUserId
}) {
    if (passiveIncomeCheckRunning) {
        console.warn(
            "Skipping passive income tick because the previous check is still running."
        );

        return;
    }

    passiveIncomeCheckRunning = true;

    try {
        const chatters =
            await getCurrentChatters({
                accessToken,
                clientId,
                broadcasterUserId,
                moderatorUserId: botUserId
            });

        let paidCount = 0;

        for (const chatter of chatters) {
            // The roulette bot itself should not farm its own currency.
            if (chatter.user_id === botUserId) {
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
//
// The first payment happens AFTER five minutes, not
// immediately when the bot launches.
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

    // Do not let this timer alone keep Node alive during shutdown.
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
