// ============================================================
// ROULETTE COOLDOWN LINES
// ============================================================
//
// Add, remove, or edit lines here whenever you want.
// Keep each line inside quotes and separated by a comma.
//
// Do NOT include the username or timer here. commands.js adds:
//   @username <random line>
//   (wheel on cooldown — 0:42 remaining)
// ============================================================

const COOLDOWN_LINES = [
    "Easy there, high roller. The roulette table has known you for five minutes.",
    "You just gambled! The table isn't going anywhere, Your dignity might be.... {time} remaining!",
    "The dealer has asked me to cut you off. This is unprecedented.",
    "You're clicking the imaginary ATM a little aggressively there.",
    "Sir, this is a Twitch stream, not a financial strategy.",
    "The roulette wheel needs a moment to recover from your last terrible decision.",
    "You have been temporarily placed in gambler timeout.",
    "The casino appreciates your enthusiasm and fears your commitment.",
    "You can't just yell !gamble until the wheel respects you.",
    "Your gambling privileges are cooling down. Your gambling problem, apparently, is not.",
    "The table saw you coming and locked itself.",
    "Please allow a moment for the consequences of your previous actions to fully sink in.",
    "Another bet already? At least pretend you're thinking about it.",
    "The house would like you to go look out a window for a bit.",
    "You are currently gambling faster than our legal department is comfortable with.",
    "Your next questionable financial decision has not unlocked yet.",
    "We admire the complete absence of self-control.",
    "The dealer remembers you. That is not a compliment.",
    "You are one !gamble away from us staging an intervention.",
    "The house always wins, but somehow you're trying to speedrun it.",
    "Your accountant has requested a cooldown.",
    "Your family has been notified.",
    "It's You! You're the one who keeps typing !gamble. The dealer is not impressed.",
    "It's You! You're the reason the cooldown exists.",
    "The dealer is concerned about your well-being.",
    "The house is concerned about the dealer's well-being.",
    "The dealer is on break, you'll need to supress your gambling urges for a few more seconds.",
    "This is not your first time checking. The answer remains no.",
    "Security has been informed of your relationship with !gamble.",
    "Least addicted chatter.",
    "Average roulette enjoyer after going 11 seconds without betting.",
    "You typed that command like rent is due tomorrow.",
    "The voices are telling you to gamble again. The bot is telling you no.",
    "99% of gamblers stop typing !gamble right before the cooldown ends."
];


function getRandomCooldownLine() {
    // Fallback keeps the bot functional if you accidentally remove
    // every line while editing this file.
    if (COOLDOWN_LINES.length === 0) {
        return "Easy there, high roller.";
    }

    const index = Math.floor(
        Math.random() * COOLDOWN_LINES.length
    );

    return COOLDOWN_LINES[index];
}


module.exports = {
    COOLDOWN_LINES,
    getRandomCooldownLine
};
