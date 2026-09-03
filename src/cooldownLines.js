const {
    MESSAGE_DEFINITIONS,
    pickMessage
} = require("./messageSettings");

// Kept exported for compatibility with any older helper/debug code.
const COOLDOWN_LINES = [
    ...MESSAGE_DEFINITIONS.cooldown.messages
];

function getRandomCooldownLine(context = {}) {
    return pickMessage(
        "cooldown",
        context
    );
}

module.exports = {
    COOLDOWN_LINES,
    getRandomCooldownLine
};
