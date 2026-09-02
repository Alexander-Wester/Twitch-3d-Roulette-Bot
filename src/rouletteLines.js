// rouletteLines.js
//
// Personality / flavour text for roulette chat.
// Keep all roulette quips here so the actual game logic stays clean.
//
// IMPORTANT:
// - These functions only return strings. They do not send chat messages.
// - We intentionally keep the number of chat messages under control.
// - Overlay/on-screen messages are NOT used here.

function pick(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
}

function fmt(amount) {
    return Number(amount).toLocaleString();
}

function signed(amount) {
    if (amount > 0) return `+${fmt(amount)}`;
    if (amount < 0) return `-${fmt(Math.abs(amount))}`;
    return "0";
}

const BETTING_CLOSED_LINES = [
    "🔒 Bets locked. No edits, no refunds, no sudden bursts of common sense.",
    "🔒 Betting closed. You have officially committed to this decision.",
    "🔒 That's it. The wheel now has custody of your chips.",
    "🔒 Bets are locked. Blame physics from this point forward.",
    "🔒 No more bets. Please direct all complaints to the spinning wooden object.",
    "🔒 Betting closed. Regret is now non-refundable.",
    "🔒 Bets locked. The time for rational thought has passed."
];

const GENERIC_BET_ACCEPTED = [
    ({ username, amount, result }) =>
        `Bet Accepted! ${username} puts ${fmt(amount)} chips on ${result}.`,
    ({ username, amount, result }) =>
        `${username} commits ${fmt(amount)} chips to ${result}. The paperwork is final.`,
    ({ username, amount, result }) =>
        `${username}: ${fmt(amount)} on ${result}. A completely normal financial decision.`,
    ({ username, amount, result }) =>
        `Accepted — ${username} has entrusted ${fmt(amount)} chips to ${result}.`
];

const GREEN_BET_LINES = [
    ({ username, amount }) =>
        `${username} puts ${fmt(amount)} on GREEN. We have located the optimist.`,
    ({ username, amount }) =>
        `${username} has placed ${fmt(amount)} on GREEN. Intrusive thoughts are winning.`,
    ({ username, amount }) =>
        `${username} bets ${fmt(amount)} on GREEN. Sensible? No. Interesting? Absolutely.`,
    ({ username, amount }) =>
        `${username} throws ${fmt(amount)} at GREEN. The wheel respects the audacity.`
];

const EXACT_BET_LINES = [
    ({ username, amount, result }) =>
        `${username} puts ${fmt(amount)} on ${result} with absolutely unjustified confidence.`,
    ({ username, amount, result }) =>
        `${username} calls ${result} exactly for ${fmt(amount)} chips. Bold strategy.`,
    ({ username, amount, result }) =>
        `${username}: ${fmt(amount)} on exactly ${result}. Skill has already been claimed.`,
    ({ username, amount, result }) =>
        `${username} singles out ${result} for ${fmt(amount)} chips. The wheel has been notified.`
];

const BIG_BANKROLL_BET_LINES = [
    ({ username, amount, result, wagerPercent }) =>
        `${username} puts ${fmt(amount)} on ${result} — about ${Math.round(wagerPercent)}% of the available bankroll. Retirement planning is going great.`,
    ({ username, amount, result }) =>
        `${username} makes a LARGE commitment: ${fmt(amount)} on ${result}.`,
    ({ username, amount, result }) =>
        `${username} appears to have confused roulette with a savings account: ${fmt(amount)} on ${result}.`
];

const ALL_IN_BET_LINES = [
    ({ username, amount, result }) =>
        `${username} is ALL IN: ${fmt(amount)} on ${result}. There is no Plan B.`,
    ({ username, amount, result }) =>
        `${username} just shoved the entire available stack — ${fmt(amount)} chips — onto ${result}.`,
    ({ username, amount, result }) =>
        `${username} has achieved maximum commitment: ALL IN on ${result} for ${fmt(amount)}.`
];

const MULTI_BET_LINES = [
    ({ username, amount, result, betCount }) =>
        `${username} adds bet #${betCount}: ${fmt(amount)} on ${result}. Diversifying the portfolio. Unfortunately, the portfolio is roulette.`,
    ({ username, amount, result, betCount }) =>
        `${username} is back for bet #${betCount}: ${fmt(amount)} on ${result}. Apparently one position wasn't enough.`,
    ({ username, amount, result }) =>
        `${username} adds another ${fmt(amount)} chips on ${result}. Hedging, chasing, or vibes — impossible to know.`
];

const REVENGE_LINES = [
    ({ username, amount, result }) =>
        `${username} is back after last round's beating: ${fmt(amount)} on ${result}. Recovery plan unclear.`,
    ({ username, amount, result }) =>
        `${username} returns immediately after being last round's biggest donor. ${fmt(amount)} on ${result}.`,
    ({ username, amount, result }) =>
        `${username} has chosen revenge: ${fmt(amount)} on ${result}. The wheel remembers nothing.`
];

const HOT_HAND_LINES = [
    ({ username, amount, result }) =>
        `${username}, last round's biggest winner, is back with ${fmt(amount)} on ${result}. One successful spin has become a system.`,
    ({ username, amount, result }) =>
        `${username} won big last round and immediately returns with ${fmt(amount)} on ${result}. Confidence is a renewable resource.`,
    ({ username, amount, result }) =>
        `${username} is pressing the hot hand: ${fmt(amount)} on ${result}. Statistical caution has left the chat.`
];

const GREEN_RESULT_LINES = [
    number => `🟢 GREEN ${number} — THERE IT IS.`,
    number => `🟢 GREEN ${number} — the forbidden vegetable.`,
    number => `🟢 GREEN ${number} — everyone who didn't bet green may begin complaining.`,
    number => `🟢 GREEN ${number} — the wheel chose violence.`,
    number => `🟢 GREEN ${number} — whoever bet green is unbearable for the next five minutes.`
];

const NORMAL_RESULT_LINES = [
    ({ color, number }) => `${color} ${number} — the wheel has spoken.`,
    ({ color, number }) => `${color} ${number} — physics has selected its victims.`,
    ({ color, number }) => `${color} ${number} — congratulations to some of you. Condolences to the rest.`,
    ({ color, number }) => `${color} ${number} — the machine has rendered judgment.`,
    ({ color, number }) => `${color} ${number}. Absolutely nothing can be done about this now.`,
    ({ color, number }) => `${color} ${number} — complaints may be filed directly with the ball.`
];

const GREEN_HIT_LINES = [
    names => `🟢 GREEN HIT! ${names} actually listened to the intrusive thoughts.`,
    names => `🟢 GREEN HIT! ${names} cashed the green bet. Please do not encourage this.`,
    names => `🟢 GREEN HIT! ${names} found the tiny green exit.`,
    names => `🟢 GREEN HIT! ${names} will now be unbearable for approximately five minutes.`
];

const STRAIGHT_HIT_LINES = [
    names => `🎯 ${names} HIT THE EXACT NUMBER. Please do not encourage them.`,
    names => `🎯 STRAIGHT-UP HIT! ${names} just got paid 35:1 for that nonsense.`,
    names => `🎯 EXACT NUMBER. ${names} has been rewarded for behaviour we specifically should not reinforce.`,
    names => `🎯 ${names} called it exactly. Skill has been claimed; evidence remains inconclusive.`
];

const HOUSE_SWEEP_LINES = [
    "🏆 Biggest winner: nobody. Perfect round for the house.",
    "🏆 Nobody won. The house would like to thank you all for your generous contributions.",
    "🏆 House sweep. Every chip lost today goes toward essential wheel maintenance.",
    "🏆 No winners. The wheel remains financially undefeated."
];

const NOBODY_LOST_LINES = [
    "Nobody Lost! Somehow everyone survived. Accounting has been notified.",
    "Nobody Lost! The house is broke!",
    "Nobody Lost! A deeply suspicious round.",
    "Nobody Lost! The wheel will be reviewing what went wrong."
];

const RESULT_PROMPTS = [
    "Want to see your result? Type !result",
    "Need the damage report? Type !result",
    "For your personal financial autopsy, type !result",
    "Type !result if you need exact confirmation of what just happened to your chips."
];

function getBettingClosedLine() {
    return pick(BETTING_CLOSED_LINES);
}

function getBetAcceptedLine(context) {
    let bank = GENERIC_BET_ACCEPTED;

     if (context.isAllIn) {
        bank = ALL_IN_BET_LINES;
    } else if (context.result === "green") {
        bank = GREEN_BET_LINES;
    } else if (/^\d+$/.test(context.result)) {
        bank = EXACT_BET_LINES;
    } else if (context.wagerPercent >= 70) {
        bank = BIG_BANKROLL_BET_LINES;
    } else if (context.betCount >= 2) {
        bank = MULTI_BET_LINES;
    } else if (context.wasBiggestLoserLastRound) {
        bank = REVENGE_LINES;
    } else if (context.wasBiggestWinnerLastRound) {
        bank = HOT_HAND_LINES;
    }

    return pick(bank)(context);
}

function getResultRevealLine(color, number) {
    if (number === 0) {
        return pick(GREEN_RESULT_LINES)(number);
    }

    return pick(NORMAL_RESULT_LINES)({ color, number });
}

function getGreenHitLine(names) {
    return pick(GREEN_HIT_LINES)(names);
}

function getStraightHitLine(names) {
    return pick(STRAIGHT_HIT_LINES)(names);
}

function getHouseSweepLine() {
    return pick(HOUSE_SWEEP_LINES);
}

function getNobodyLostLine() {
    return pick(NOBODY_LOST_LINES);
}

function getResultPromptLine() {
    return pick(RESULT_PROMPTS);
}

function getUserResultLine(summary, flags = {}) {
    const amount = summary.balanceChange;
    const username = summary.username;

    if (amount === 0) {
        return `➖ ${username} broke even. The wheel has declined to form an opinion.`;
    }

    if (amount > 0) {
        if (flags.isBiggestWinner) {
            if (amount >= 5000) {
                return `🏆 ${username} extracts ${signed(amount)} chips from the machine. Security has been informed.`;
            }

            return `🏆 ${username} leads the table with ${signed(amount)} chips. Suspiciously competent.`;
        }

        if (amount >= 5000) {
            return `✅ ${username} walks away ${signed(amount)} chips richer and considerably more confident than they should be.`;
        }

        return pick([
            `✅ ${username} wins ${signed(amount)} chips. The system works, apparently.`,
            `✅ ${username} finishes ${signed(amount)} chips up. Dangerous reinforcement.`,
            `✅ ${username} takes ${signed(amount)} chips from the wheel.`
        ]);
    }

    if (summary.newBalance === 0) {
        return `💀 ${username} has achieved financial zero: ${signed(amount)} chips.`;
    }

    if (flags.isBiggestLoser) {
        if (amount <= -5000) {
            return `💀 ${username} donates ${fmt(Math.abs(amount))} chips. We will be naming a wing of the casino after them.`;
        }

        return `💀 ${username} leads the losses at ${signed(amount)} chips. Character development acquired.`;
    }

    if (amount <= -5000) {
        return `❌ ${username} loses ${signed(amount)} chips. A generous contribution to ongoing wheel maintenance.`;
    }

    return pick([
        `❌ ${username} loses ${signed(amount)} chips. A manageable amount of character development.`,
        `❌ ${username} finishes ${signed(amount)} chips down. The wheel appreciates the donation.`,
        `❌ ${username} loses ${signed(amount)} chips. Unfortunate, but extremely on brand for roulette.`
    ]);
}

function getBiggestWinnerLine(names, amount, count) {
    if (amount >= 5000) {
        return `🏆 ${count === 1 ? names : `${names} each`} extracts ${signed(amount)} chips from the machine. Security has been informed.`;
    }

    return `🏆 Biggest ${count === 1 ? "winner" : "winners"}: ${names} ${signed(amount)} chips${count > 1 ? " each" : ""}. Suspiciously competent.`;
}

function getBiggestLoserLine(names, amount, count) {
    if (amount <= -5000) {
        return `💀 ${count === 1 ? names : `${names} each`} donates ${fmt(Math.abs(amount))} chips. We will be naming a wing of the casino after ${count === 1 ? "them" : "them"}.`;
    }

    return `💀 Biggest ${count === 1 ? "loss" : "losses"}: ${names} ${signed(amount)} chips${count > 1 ? " each" : ""}. Character development acquired.`;
}

module.exports = {
    getBettingClosedLine,
    getBetAcceptedLine,
    getResultRevealLine,
    getGreenHitLine,
    getStraightHitLine,
    getHouseSweepLine,
    getNobodyLostLine,
    getResultPromptLine,
    getUserResultLine,
    getBiggestWinnerLine,
    getBiggestLoserLine
};
