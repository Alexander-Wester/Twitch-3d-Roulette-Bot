const {
    getRandomIdleGambleLine
} = require("./idleGambleLines");


// ----------------------------------------------------
// Idle reminder configuration
//
// Change this one value if you ever want a different
// delay. 20 * 60 * 1000 = 20 minutes.
// ----------------------------------------------------

const IDLE_GAMBLE_REMINDER_MS =
    20 * 60 * 1000;

let reminderTimer = null;
let sendChatMessageFn = null;
let isRouletteIdleFn = null;


// ----------------------------------------------------
// Schedule the next reminder
// ----------------------------------------------------

function scheduleNextReminder() {
    if (reminderTimer) {
        clearTimeout(reminderTimer);
    }

    reminderTimer = setTimeout(
        async () => {
            reminderTimer = null;

            try {
                const rouletteIsIdle =
                    !isRouletteIdleFn ||
                    isRouletteIdleFn();

                if (
                    rouletteIsIdle &&
                    sendChatMessageFn
                ) {
                    const line =
                        getRandomIdleGambleLine();

                    await sendChatMessageFn(
                        line
                    );

                    console.log(
                        "[Idle Roulette Reminder] " +
                        line
                    );
                }
            } catch (error) {
                console.error(
                    "[Idle Roulette Reminder] Error:",
                    error.message
                );
            }

            // If nobody starts another round, keep reminding
            // chat once every 20 minutes of continued inactivity.
            scheduleNextReminder();
        },
        IDLE_GAMBLE_REMINDER_MS
    );
}


// ----------------------------------------------------
// Start the idle reminder system
// ----------------------------------------------------

function startIdleGambleReminder({
    sendChatMessage,
    isRouletteIdle
}) {
    sendChatMessageFn =
        sendChatMessage;

    isRouletteIdleFn =
        isRouletteIdle;

    scheduleNextReminder();

    console.log(
        "[Idle Roulette Reminder] " +
        "Started — 20 minute idle timer."
    );
}


// ----------------------------------------------------
// A NEW roulette round has started.
//
// Calling this cancels the old countdown and gives the
// wheel a fresh 20 minutes before another reminder.
// ----------------------------------------------------

function resetIdleGambleReminder() {
    if (!sendChatMessageFn) {
        return;
    }

    scheduleNextReminder();

    console.log(
        "[Idle Roulette Reminder] " +
        "Round started — timer reset."
    );
}


module.exports = {
    startIdleGambleReminder,
    resetIdleGambleReminder,
    IDLE_GAMBLE_REMINDER_MS
};
