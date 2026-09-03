const {
    getRandomIdleGambleLine
} = require("./idleGambleLines");

const {
    getSettings,
    onSettingsChanged
} = require("./settings");


let reminderTimer = null;
let sendChatMessageFn = null;
let isRouletteIdleFn = null;
let unsubscribeSettings = null;


function clearReminderTimer() {
    if (reminderTimer) {
        clearTimeout(reminderTimer);
        reminderTimer = null;
    }
}


// ----------------------------------------------------
// Schedule the next reminder using the current settings.
// ----------------------------------------------------

function scheduleNextReminder() {
    clearReminderTimer();

    const settings = getSettings();

    if (
        !settings.idleReminderEnabled ||
        !sendChatMessageFn
    ) {
        return;
    }

    const delayMs =
        settings.idleReminderMinutes * 60 * 1000;

    reminderTimer = setTimeout(
        async () => {
            reminderTimer = null;

            try {
                const currentSettings =
                    getSettings();

                const rouletteIsIdle =
                    !isRouletteIdleFn ||
                    isRouletteIdleFn();

                if (
                    currentSettings.idleReminderEnabled &&
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

            // Continued inactivity schedules another reminder using
            // whatever interval is currently selected in Settings.
            scheduleNextReminder();
        },
        delayMs
    );

    reminderTimer.unref?.();
}


// ----------------------------------------------------
// Start the idle reminder system and keep it synchronized
// with Settings-page changes.
// ----------------------------------------------------

function startIdleGambleReminder({
    sendChatMessage,
    isRouletteIdle
}) {
    sendChatMessageFn =
        sendChatMessage;

    isRouletteIdleFn =
        isRouletteIdle;

    unsubscribeSettings?.();

    unsubscribeSettings =
        onSettingsChanged(
            (_settings, changedKeys) => {
                if (
                    changedKeys.some(key => [
                        "idleReminderEnabled",
                        "idleReminderMinutes"
                    ].includes(key))
                ) {
                    scheduleNextReminder();

                    const settings = getSettings();

                    console.log(
                        settings.idleReminderEnabled
                            ? `[Idle Roulette Reminder] Updated — ${settings.idleReminderMinutes} minute idle timer.`
                            : "[Idle Roulette Reminder] Disabled in settings."
                    );
                }
            }
        );

    scheduleNextReminder();

    const settings = getSettings();

    console.log(
        settings.idleReminderEnabled
            ? `[Idle Roulette Reminder] Started — ${settings.idleReminderMinutes} minute idle timer.`
            : "[Idle Roulette Reminder] Disabled in settings."
    );
}


// ----------------------------------------------------
// A NEW roulette round has started.
// ----------------------------------------------------

function resetIdleGambleReminder() {
    if (!sendChatMessageFn) {
        return;
    }

    scheduleNextReminder();

    if (getSettings().idleReminderEnabled) {
        console.log(
            "[Idle Roulette Reminder] " +
            "Round started — timer reset."
        );
    }
}


module.exports = {
    startIdleGambleReminder,
    resetIdleGambleReminder
};
