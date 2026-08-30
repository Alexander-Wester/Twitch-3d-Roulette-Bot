const {
    getBalance,
    changeBalance
} = require("./database");

const BETTING_TIME_MS = 20000;

const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9,
    12, 14, 16, 18,
    19, 21, 23, 25, 27,
    30, 32, 34, 36
]);

let activeRound = null;
let nextRoundId = 1;


// ----------------------------------------------------
// Create a new roulette round
// ----------------------------------------------------

function createRound(sendChatMessage) {
    const round = {
        id: nextRoundId++,
        status: "betting",
        bets: [],
        startedAt: Date.now(),
        closeTimer: null
    };

    round.closeTimer = setTimeout(async () => {
        if (
            activeRound &&
            activeRound.id === round.id &&
            activeRound.status === "betting"
        ) {
            activeRound.status = "closed";

            console.log(
                `Round #${round.id}: betting is now closed.`
            );

            if (sendChatMessage) {
                await sendChatMessage(
                    `Betting is now closed for Round #${round.id}!`
                );
            }
        }
    }, BETTING_TIME_MS);

    activeRound = round;

    console.log(
        `Round #${round.id} started. Betting is open for ${BETTING_TIME_MS / 1000} seconds.`
    );

    if (sendChatMessage) {
        sendChatMessage(
            `Round #${round.id} has started! Betting is open for ${BETTING_TIME_MS / 1000} seconds.`
        );
    }

    return round;
}


// ----------------------------------------------------
// How much money does this user already have wagered?
// ----------------------------------------------------

function getReservedAmount(userId) {
    if (!activeRound) {
        return 0;
    }

    return activeRound.bets
        .filter(bet => bet.userId === userId)
        .reduce(
            (total, bet) => total + bet.amount,
            0
        );
}


// ----------------------------------------------------
// Actual amount they are still allowed to bet
// ----------------------------------------------------

function getAvailableBalance(userId, username) {
    const balance = getBalance(
        userId,
        username
    );

    const reserved = getReservedAmount(userId);

    return balance - reserved;
}


// ----------------------------------------------------
// Place a bet
// ----------------------------------------------------

function placeBet(
    userId,
    username,
    result,
    amount,
    sendChatMessage
) {
    // If a round exists but betting has closed,
    // no more bets can be added.
    if (
        activeRound &&
        activeRound.status !== "betting"
    ) {
        return {
            success: false,
            reason: "betting_closed"
        };
    }

    const availableBalance =
        getAvailableBalance(userId, username);

    if (amount > availableBalance) {
        return {
            success: false,
            reason: "insufficient_balance",
            availableBalance
        };
    }

    const round =
        activeRound || createRound(sendChatMessage);

    round.bets.push({
        userId,
        username,
        result,
        amount
    });

    console.log(
        `Round #${round.id}: ${username} -> ${amount} on ${result}`
    );

    return {
        success: true,
        roundId: round.id,
        availableBalance:
            availableBalance - amount
    };
}


// ----------------------------------------------------
// Determine whether a bet won
// ----------------------------------------------------

function betWins(betResult, winningNumber) {
    // Straight number bet
    if (/^\d+$/.test(betResult)) {
        return Number(betResult) === winningNumber;
    }

    if (betResult === "green") {
        return winningNumber === 0;
    }

    if (winningNumber === 0) {
        // Zero loses all red/black/odd/even bets.
        return false;
    }

    if (betResult === "red") {
        return RED_NUMBERS.has(winningNumber);
    }

    if (betResult === "black") {
        return !RED_NUMBERS.has(winningNumber);
    }

    if (betResult === "odd") {
        return winningNumber % 2 === 1;
    }

    if (betResult === "even") {
        return winningNumber % 2 === 0;
    }

    return false;
}


// ----------------------------------------------------
// Profit multiplier
//
// Red/black/odd/even = 1:1
// Exact number = 35:1
// Green = 35:1 because our wheel has only one green 0.
// ----------------------------------------------------

function getProfitMultiplier(result) {
    if (
        result === "green" ||
        /^\d+$/.test(result)
    ) {
        return 35;
    }

    return 1;
}


// ----------------------------------------------------
// Resolve the entire current round
// ----------------------------------------------------

function resolveRound(winningNumber) {
    if (!Number.isInteger(winningNumber)) {
        throw new Error(
            "Winning number must be an integer."
        );
    }

    if (
        winningNumber < 0 ||
        winningNumber > 36
    ) {
        throw new Error(
            "Winning number must be between 0 and 36."
        );
    }

    if (!activeRound) {
        return {
            success: false,
            reason: "no_active_round"
        };
    }

    clearTimeout(activeRound.closeTimer);

    const round = activeRound;

    round.status = "resolving";

    const results = [];

    for (const bet of round.bets) {
        const won = betWins(
            bet.result,
            winningNumber
        );

        let balanceChange;

        if (won) {
            const multiplier =
                getProfitMultiplier(bet.result);

            // Stakes were only reserved, not actually
            // removed from the database.
            //
            // Therefore we only add PROFIT here.
            balanceChange =
                bet.amount * multiplier;
        } else {
            // Losing stake is now actually removed.
            balanceChange =
                -bet.amount;
        }

        const newBalance = changeBalance(
            bet.userId,
            bet.username,
            balanceChange
        );

        results.push({
            ...bet,
            won,
            balanceChange,
            newBalance
        });
    }

    round.status = "resolved";

    console.log(
        `Round #${round.id} resolved: ${winningNumber}`
    );

    activeRound = null;

    return {
        success: true,
        roundId: round.id,
        winningNumber,
        results
    };
}


function getActiveRound() {
    return activeRound;
}


module.exports = {
    placeBet,
    resolveRound,
    getReservedAmount,
    getAvailableBalance,
    getActiveRound
};