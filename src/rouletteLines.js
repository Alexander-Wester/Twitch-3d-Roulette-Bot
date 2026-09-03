// rouletteLines.js
//
// Personality / custom text is stored in messageSettings.js + the user's
// AppData/messages.json. This module only chooses the correct message type
// and supplies values for its placeholders.

const {
    pickMessage
} = require("./messageSettings");

function fmt(amount) {
    return Number(amount).toLocaleString();
}

function signed(amount) {
    if (amount > 0) return `+${fmt(amount)}`;
    if (amount < 0) return `-${fmt(Math.abs(amount))}`;
    return "0";
}

function betContext(context) {
    return {
        ...context,
        amount: fmt(context.amount),
        wagerPercent: Math.round(context.wagerPercent || 0)
    };
}

function getBettingClosedLine() {
    return pickMessage("bettingClosed");
}

function getBetAcceptedLine(context) {
    let type = "genericBet";

    if (context.isAllIn) {
        type = "allInBet";
    } else if (context.result === "green") {
        type = "greenBet";
    } else if (/^\d+$/.test(context.result)) {
        type = "exactBet";
    } else if (context.wagerPercent >= 70) {
        type = "bigBankrollBet";
    } else if (context.betCount >= 2) {
        type = "multiBet";
    } else if (context.wasBiggestLoserLastRound) {
        type = "revengeBet";
    } else if (context.wasBiggestWinnerLastRound) {
        type = "hotHandBet";
    }

    return pickMessage(
        type,
        betContext(context)
    );
}

function getResultRevealLine(color, number) {
    return pickMessage(
        number === 0
            ? "greenResult"
            : "normalResult",
        {
            color,
            number
        }
    );
}

function getGreenHitLine(names) {
    return pickMessage(
        "greenHit",
        { names }
    );
}

function getStraightHitLine(names) {
    return pickMessage(
        "straightHit",
        { names }
    );
}

function getHouseSweepLine() {
    return pickMessage("houseSweep");
}

function getNobodyLostLine() {
    return pickMessage("nobodyLost");
}

function getResultPromptLine() {
    return pickMessage("resultPrompt");
}

function resultContext(summary) {
    return {
        username: summary.username,
        signedAmount: signed(summary.balanceChange),
        amount: fmt(Math.abs(summary.balanceChange))
    };
}

function getUserResultLine(summary, flags = {}) {
    const amount = summary.balanceChange;
    const context = resultContext(summary);

    if (amount === 0) {
        return pickMessage(
            "userBreakEven",
            context
        );
    }

    if (amount > 0) {
        if (flags.isBiggestWinner) {
            return pickMessage(
                amount >= 5000
                    ? "userTopWinnerHuge"
                    : "userTopWinner",
                context
            );
        }

        return pickMessage(
            amount >= 5000
                ? "userWinHuge"
                : "userWinNormal",
            context
        );
    }

    if (summary.newBalance === 0) {
        return pickMessage(
            "userBankrupt",
            context
        );
    }

    if (flags.isBiggestLoser) {
        return pickMessage(
            amount <= -5000
                ? "userTopLoserHuge"
                : "userTopLoser",
            context
        );
    }

    return pickMessage(
        amount <= -5000
            ? "userLossHuge"
            : "userLossNormal",
        context
    );
}

function getBiggestWinnerLine(names, amount, count) {
    const context = {
        names,
        namesDisplay:
            count === 1
                ? names
                : `${names} each`,
        signedAmount: signed(amount),
        amount: fmt(Math.abs(amount)),
        count,
        winnerLabel:
            count === 1
                ? "winner"
                : "winners",
        eachSuffix:
            count > 1
                ? " each"
                : ""
    };

    return pickMessage(
        amount >= 5000
            ? "biggestWinnerHuge"
            : "biggestWinner",
        context
    );
}

function getBiggestLoserLine(names, amount, count) {
    const context = {
        names,
        namesDisplay:
            count === 1
                ? names
                : `${names} each`,
        signedAmount: signed(amount),
        amount: fmt(Math.abs(amount)),
        count,
        loserLabel:
            count === 1
                ? "loss"
                : "losses",
        eachSuffix:
            count > 1
                ? " each"
                : ""
    };

    return pickMessage(
        amount <= -5000
            ? "biggestLoserHuge"
            : "biggestLoser",
        context
    );
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
