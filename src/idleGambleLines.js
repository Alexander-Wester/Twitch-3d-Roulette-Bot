// ============================================================
// Idle roulette reminder lines
//
// Edit this list however you like:
// - delete lines you don't want
// - rewrite any line
// - add new quoted lines
//
// One random line is used whenever the roulette table has
// been idle for the configured reminder interval.
// ============================================================

const IDLE_GAMBLE_LINES = [
    "It has been 20 minutes since somebody made a terrible financial decision. !gamble",
    "The roulette wheel hasn't ruined anyone's evening in 20 minutes. Who wants to fix that? !gamble",
    "GAMBLING DEFICIENCY DETECTED. Please type !gamble immediately.",
    "The wheel is getting cold. Somebody sacrifice some chips. !gamble",
    "20 minutes without gambling? I barely recognize this community anymore. !gamble",
    "The casino has noticed an alarming amount of financial responsibility in chat. !gamble",
    "Nobody has gambled in 20 minutes. Are you people feeling okay? !gamble",
    "The house cannot win if nobody makes bad decisions. Please cooperate. !gamble",
    "Reminder: those chips aren't going to lose themselves. !gamble",
    "Some of you still have money. This needs to be addressed. !gamble",
    "The roulette table has been untouched for 20 minutes. Frankly, it's embarrassing. !gamble",
    "Financial stability detected. Deploying roulette. !gamble",
    "The dealer has been standing here for 20 minutes questioning his career choices. !gamble",
    "Imagine having chips and simply... keeping them. Couldn't be me. !gamble",
    "Come on. One little spin. What's the worst that could happen? !gamble",
    "This is your periodic reminder that 99% of Twitch chatters stop gambling right before they become fake-millionaires. !gamble",
    "Your fake retirement fund has been sitting untouched for far too long. !gamble",
    "The wheel would like to speak with whoever decided to start making sensible choices. !gamble",
    "You didn't come all this way to responsibly accumulate imaginary currency. !gamble",
    "The roulette wheel is accepting donations again. !gamble",
    "Someone please gamble. The house has quarterly targets to hit. !gamble",
    "The safest bet is not gambling. Fortunately, nobody here is interested in the safest bet. !gamble",
    "There are two types of people in this chat: gamblers and people who haven't typed !gamble yet.",
    "I've seen far too many intact balances lately. !gamble",
    "You could save your chips... but then how would you experience the thrill of immediately regretting something? !gamble",
    "The wheel has gone 20 minutes without attention and is beginning to develop abandonment issues. !gamble",
    "Someone bet on green. I want to see something irresponsible. !gamble",
    "Red. Black. Green. Your children's inheritance. The possibilities are endless. !gamble",
    "The roulette table is open and absolutely nothing bad has ever followed that sentence. !gamble",
    "You know what would really improve this peaceful moment? Gambling. !gamble",
    "This stream contains unused chips. Management considers this unacceptable. !gamble",
    "The bot is legally required* to remind you that gambling exists. !gamble  *not legally required",
    "Dealer here. Just wondering whether anybody plans on making a mistake tonight. !gamble",
    "I didn't build a physics-based roulette wheel so you people could demonstrate *SELF CONTROL*. !gamble",
    "The wheel spins using advanced physics. Your decision to bet does not. !gamble",
    "The viewers yearn for the wheel. !gamble"
];


function getRandomIdleGambleLine() {
    if (IDLE_GAMBLE_LINES.length === 0) {
        return "The roulette table is feeling neglected. !gamble";
    }

    const index =
        Math.floor(
            Math.random() *
            IDLE_GAMBLE_LINES.length
        );

    return IDLE_GAMBLE_LINES[index];
}


module.exports = {
    IDLE_GAMBLE_LINES,
    getRandomIdleGambleLine
};
