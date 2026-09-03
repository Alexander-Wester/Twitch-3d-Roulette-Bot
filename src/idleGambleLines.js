const {
    MESSAGE_DEFINITIONS,
    pickMessage
} = require("./messageSettings");

// Kept exported for compatibility with any older helper/debug code.
const IDLE_GAMBLE_LINES = [
    ...MESSAGE_DEFINITIONS.idleReminder.messages
];

function getRandomIdleGambleLine() {
    return pickMessage("idleReminder");
}

module.exports = {
    IDLE_GAMBLE_LINES,
    getRandomIdleGambleLine
};
