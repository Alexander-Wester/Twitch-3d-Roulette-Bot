const {
    getBalance,
    changeBalance,
    saveRouletteResult,
    getNextRouletteRoundId
} = require("./database");

const {
    broadcastOverlayMessage
} = require("./overlayServer");

const {
    getSettings
} = require("./settings");

const {
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
} = require("./rouletteLines");

const BALL_RELEASE_DELAY_MS = 500;
const RESULT_DISPLAY_MS = 4000;

const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9,
    12, 14, 16, 18,
    19, 21, 23, 25, 27,
    30, 32, 34, 36
]);

let activeRound = null;
// Continue round numbering across launches so completed-result
// history is never overwritten by reused round IDs.
let nextRoundId = getNextRouletteRoundId();
let cooldownEndsAt = 0;
let hideTableTimer = null;

// Used only for a little continuity between rounds.
// Nothing here is persisted; restarting the bot simply clears it.
let previousRoundHighlights = {
    biggestWinnerIds: new Set(),
    biggestLoserIds: new Set()
};


// ----------------------------------------------------
// Timing helpers
// ----------------------------------------------------

function randomBettingTimeMs() {
    const settings = getSettings();

    const minimumMs =
        settings.bettingTimeMinSeconds * 1000;

    const maximumMs =
        settings.bettingTimeMaxSeconds * 1000;

    return (
        minimumMs +
        Math.floor(
            Math.random() *
            (
                maximumMs -
                minimumMs +
                1
            )
        )
    );
}


function getCooldownRemainingMs() {
    return Math.max(
        0,
        cooldownEndsAt - Date.now()
    );
}


function getRouletteState() {
    if (activeRound) {
        const effectiveStatus =
            activeRound.status === "betting" &&
            Date.now() >= activeRound.bettingEndsAt
                ? "closed"
                : activeRound.status;

        return {
            status: effectiveStatus,
            roundId: activeRound.id,
            bettingEndsAt: activeRound.bettingEndsAt,
            cooldownRemainingMs: 0
        };
    }

    const cooldownRemainingMs =
        getCooldownRemainingMs();

    if (cooldownRemainingMs > 0) {
        return {
            status: "cooldown",
            roundId: null,
            bettingEndsAt: null,
            cooldownRemainingMs
        };
    }

    return {
        status: "idle",
        roundId: null,
        bettingEndsAt: null,
        cooldownRemainingMs: 0
    };
}


// ----------------------------------------------------
// Create a new roulette round
// ----------------------------------------------------

function createRound(sendChatMessage) {
    const bettingDurationMs =
        randomBettingTimeMs();

    const startedAt = Date.now();

    const round = {
        id: nextRoundId++,
        status: "betting",
        bets: [],
        startedAt,
        bettingDurationMs,
        bettingEndsAt:
            startedAt + bettingDurationMs,
        closeTimer: null,
        launchTimer: null
    };

    activeRound = round;

    if (hideTableTimer) {
        clearTimeout(hideTableTimer);
        hideTableTimer = null;
    }

    console.log(
        `Round #${round.id} started. ` +
        `Betting is open for ` +
        `${(bettingDurationMs / 1000).toFixed(2)} seconds.`
    );

    // The overlay, not Twitch chat, announces the opening.
    // No extra personality text is added to the overlay.
    broadcastOverlayMessage({
        type: "roundStarted",
        roundId: round.id,
        bettingDurationMs,
        bettingEndsAt: round.bettingEndsAt
    });

    round.closeTimer = setTimeout(
        async () => {
            if (
                !activeRound ||
                activeRound.id !== round.id ||
                activeRound.status !== "betting"
            ) {
                return;
            }

            // This status change is the authoritative cutoff.
            activeRound.status = "closed";

            console.log(
                `Round #${round.id}: betting is now closed.`
            );

            broadcastOverlayMessage({
                type: "bettingClosed",
                roundId: round.id
            });

            // Start the release delay immediately. Twitch API latency
            // must never change when the physical ball is sent.
            round.launchTimer = setTimeout(
                () => {
                    if (
                        !activeRound ||
                        activeRound.id !== round.id ||
                        activeRound.status !== "closed"
                    ) {
                        return;
                    }

                    activeRound.status = "spinning";

                    console.log(
                        `Round #${round.id}: releasing the ball.`
                    );

                    broadcastOverlayMessage({
                        type: "launchBall",
                        roundId: round.id
                    });
                },
                BALL_RELEASE_DELAY_MS
            );

            if (sendChatMessage) {
                await sendChatMessage(
                    getBettingClosedLine()
                );
            }
        },
        bettingDurationMs
    );

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
// Personality context for an accepted bet.
//
// We deliberately produce at most ONE accepted-bet chat line,
// so personality does not turn every round into chat spam.
// ----------------------------------------------------

function oppositeOf(result) {
    if (result === "red") return "black";
    if (result === "black") return "red";
    if (result === "odd") return "even";
    if (result === "even") return "odd";
    return null;
}


function buildBetContext(
    round,
    userId,
    username,
    result,
    amount,
    availableBalanceBeforeBet
) {
    const existingUserBets =
        round.bets.filter(
            bet => bet.userId === userId
        );

    const sameResultCount =
        round.bets.filter(
            bet => bet.result === result
        ).length;

    const opposite =
        oppositeOf(result);

    const oppositeCount =
        opposite
            ? round.bets.filter(
                bet => bet.result === opposite
            ).length
            : 0;

    const wagerPercent =
        availableBalanceBeforeBet > 0
            ? (
                amount /
                availableBalanceBeforeBet
            ) * 100
            : 0;

    return {
        userId,
        username,
        result,
        amount,
        betCount:
            existingUserBets.length + 1,
        wagerPercent,
        isAllIn:
            amount ===
            availableBalanceBeforeBet,
        isConsensus:
            Boolean(opposite) &&
            sameResultCount >= 2 &&
            sameResultCount > oppositeCount,
        isContrarian:
            Boolean(opposite) &&
            oppositeCount >= 2 &&
            sameResultCount === 0,
        wasBiggestWinnerLastRound:
            previousRoundHighlights
                .biggestWinnerIds
                .has(userId),
        wasBiggestLoserLastRound:
            previousRoundHighlights
                .biggestLoserIds
                .has(userId)
    };
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
    const cooldownRemainingMs =
        getCooldownRemainingMs();

    if (
        !activeRound &&
        cooldownRemainingMs > 0
    ) {
        return {
            success: false,
            reason: "cooldown",
            cooldownRemainingMs
        };
    }

    if (
        activeRound &&
        activeRound.status === "betting" &&
        Date.now() >= activeRound.bettingEndsAt
    ) {
        return {
            success: false,
            reason: "closed"
        };
    }

    if (
        activeRound &&
        activeRound.status !== "betting"
    ) {
        return {
            success: false,
            reason: activeRound.status
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

    const betContext =
        buildBetContext(
            round,
            userId,
            username,
            result,
            amount,
            availableBalance
        );

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
            availableBalance - amount,
        chatMessage:
            getBetAcceptedLine(
                betContext
            )
    };
}


// ----------------------------------------------------
// Determine whether a bet won
// ----------------------------------------------------

function betWins(betResult, winningNumber) {
    if (/^\d+$/.test(betResult)) {
        return Number(betResult) === winningNumber;
    }

    if (betResult === "green") {
        return winningNumber === 0;
    }

    if (winningNumber === 0) {
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


function getNumberColor(winningNumber) {
    if (winningNumber === 0) {
        return "GREEN";
    }

    if (RED_NUMBERS.has(winningNumber)) {
        return "RED";
    }

    return "BLACK";
}


// ----------------------------------------------------
// Group all bets from the same user into one round result
// ----------------------------------------------------

function summarizeResultsByUser(results) {
    const byUser = new Map();

    for (const result of results) {
        let summary =
            byUser.get(result.userId);

        if (!summary) {
            summary = {
                userId: result.userId,
                username: result.username,
                bets: [],
                totalWagered: 0,
                balanceChange: 0,
                newBalance: result.newBalance
            };

            byUser.set(
                result.userId,
                summary
            );
        }

        summary.bets.push({
            result: result.result,
            amount: result.amount,
            won: result.won,
            balanceChange:
                result.balanceChange
        });

        summary.totalWagered +=
            result.amount;

        summary.balanceChange +=
            result.balanceChange;

        summary.newBalance =
            result.newBalance;

        summary.username =
            result.username;
    }

    return Array.from(
        byUser.values()
    );
}


function formatNameList(names) {
    if (names.length === 1) {
        return names[0];
    }

    if (names.length === 2) {
        return `${names[0]} and ${names[1]}`;
    }

    return (
        names.slice(0, -1).join(", ") +
        `, and ${names[names.length - 1]}`
    );
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
    clearTimeout(activeRound.launchTimer);

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

            balanceChange =
                bet.amount * multiplier;
        } else {
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

    const userSummaries =
        summarizeResultsByUser(results);

    for (const summary of userSummaries) {
        saveRouletteResult({
            roundId: round.id,
            userId: summary.userId,
            username: summary.username,
            winningNumber,
            bets: summary.bets,
            totalWagered:
                summary.totalWagered,
            balanceChange:
                summary.balanceChange,
            balanceAfter:
                summary.newBalance
        });
    }

    // Remember only the previous round's biggest winner/loser IDs.
    // This is used for next-round "revenge" / "hot hand" lines.
    const positive =
        userSummaries.filter(
            summary =>
                summary.balanceChange > 0
        );

    const negative =
        userSummaries.filter(
            summary =>
                summary.balanceChange < 0
        );

    const biggestWin =
        positive.length
            ? Math.max(
                ...positive.map(
                    summary =>
                        summary.balanceChange
                )
            )
            : null;

    const biggestLoss =
        negative.length
            ? Math.min(
                ...negative.map(
                    summary =>
                        summary.balanceChange
                )
            )
            : null;

    previousRoundHighlights = {
        biggestWinnerIds:
            new Set(
                positive
                    .filter(
                        summary =>
                            summary.balanceChange ===
                            biggestWin
                    )
                    .map(
                        summary =>
                            summary.userId
                    )
            ),
        biggestLoserIds:
            new Set(
                negative
                    .filter(
                        summary =>
                            summary.balanceChange ===
                            biggestLoss
                    )
                    .map(
                        summary =>
                            summary.userId
                    )
            )
    };

    round.status = "resolved";

    console.log(
        `Round #${round.id} resolved: ${winningNumber}`
    );

    const cooldownMs =
        getSettings().cooldownMinutes * 60 * 1000;

    cooldownEndsAt =
        Date.now() + cooldownMs;

    activeRound = null;

    return {
        success: true,
        roundId: round.id,
        winningNumber,
        results,
        userSummaries,
        cooldownEndsAt
    };
}


// ----------------------------------------------------
// Announce a resolved result in Twitch chat
// ----------------------------------------------------

async function announceResolvedRound(
    resolved,
    sendChatMessage
) {
    if (!sendChatMessage) {
        return;
    }

    const color =
        getNumberColor(
            resolved.winningNumber
        );

    // Winning pocket appears exactly once in the
    // automatic post-spin chat messages.
    await sendChatMessage(
        getResultRevealLine(
            color,
            resolved.winningNumber
        )
    );

    const summaries =
        resolved.userSummaries ||
        summarizeResultsByUser(
            resolved.results
        );

    const winningSummaries =
        summaries.filter(
            summary =>
                summary.balanceChange > 0
        );

    const losingSummaries =
        summaries.filter(
            summary =>
                summary.balanceChange < 0
        );

    const biggestWin =
        winningSummaries.length > 0
            ? Math.max(
                ...winningSummaries.map(
                    summary =>
                        summary.balanceChange
                )
            )
            : null;

    const biggestLoss =
        losingSummaries.length > 0
            ? Math.min(
                ...losingSummaries.map(
                    summary =>
                        summary.balanceChange
                )
            )
            : null;

    const biggestWinnerIds =
        new Set(
            winningSummaries
                .filter(
                    summary =>
                        summary.balanceChange ===
                        biggestWin
                )
                .map(
                    summary => summary.userId
                )
        );

    const biggestLoserIds =
        new Set(
            losingSummaries
                .filter(
                    summary =>
                        summary.balanceChange ===
                        biggestLoss
                )
                .map(
                    summary => summary.userId
                )
        );


    // ------------------------------------------------
    // Long-shot callouts.
    // ------------------------------------------------

    const greenHitters =
        new Set();

    const straightUpHitters =
        new Set();

    for (const result of resolved.results) {
        if (!result.won) {
            continue;
        }

        if (result.result === "green") {
            greenHitters.add(
                result.username
            );
        }

        if (/^\d+$/.test(result.result)) {
            straightUpHitters.add(
                result.username
            );
        }
    }

    if (greenHitters.size > 0) {
        const names =
            formatNameList(
                Array.from(greenHitters)
            );

        await sendChatMessage(
            getGreenHitLine(names)
        );
    }

    if (straightUpHitters.size > 0) {
        const names =
            formatNameList(
                Array.from(
                    straightUpHitters
                )
            );

        await sendChatMessage(
            getStraightHitLine(names)
        );
    }


    // ------------------------------------------------
    // Small-chat mode:
    // announce every user's NET result exactly once.
    // ------------------------------------------------

    if (getSettings().announceAllResults) {
        for (const summary of summaries) {
            await sendChatMessage(
                getUserResultLine(
                    summary,
                    {
                        isBiggestWinner:
                            biggestWinnerIds.has(
                                summary.userId
                            ),
                        isBiggestLoser:
                            biggestLoserIds.has(
                                summary.userId
                            )
                    }
                )
            );
        }

        return;
    }


    // ------------------------------------------------
    // Large-chat mode:
    // only announce biggest winner(s) / biggest loss(es).
    // ------------------------------------------------

    if (biggestWin !== null) {
        const biggestWinners =
            winningSummaries.filter(
                summary =>
                    summary.balanceChange ===
                    biggestWin
            );

        const names =
            formatNameList(
                biggestWinners.map(
                    summary =>
                        summary.username
                )
            );

        await sendChatMessage(
            getBiggestWinnerLine(
                names,
                biggestWin,
                biggestWinners.length
            )
        );
    } else {
        await sendChatMessage(
            getHouseSweepLine()
        );
    }

    if (biggestLoss !== null) {
        const biggestLosers =
            losingSummaries.filter(
                summary =>
                    summary.balanceChange ===
                    biggestLoss
            );

        const names =
            formatNameList(
                biggestLosers.map(
                    summary =>
                        summary.username
                )
            );

        await sendChatMessage(
            getBiggestLoserLine(
                names,
                biggestLoss,
                biggestLosers.length
            )
        );
    } else {
        await sendChatMessage(
            getNobodyLostLine()
        );
    }

    await sendChatMessage(
        getResultPromptLine()
    );
}


// ----------------------------------------------------
// Messages sent BACK from the roulette browser source
// ----------------------------------------------------

async function handleOverlayMessage(
    data,
    sendChatMessage
) {
    if (
        !data ||
        data.type !== "rouletteResult"
    ) {
        return;
    }

    const roundId = Number(data.roundId);
    const winningNumber = Number(data.winningNumber);

    if (
        !Number.isInteger(roundId) ||
        !Number.isInteger(winningNumber) ||
        winningNumber < 0 ||
        winningNumber > 36
    ) {
        console.warn(
            "Ignoring invalid roulette result from overlay:",
            data
        );

        return;
    }

    // Negative round IDs are reserved for the desktop Debug tab's
    // isolated overlay test spins. They exercise the real physics,
    // but must never create payouts or Twitch result messages.
    if (roundId < 0) {
        console.log(
            `[Debug] Overlay test spin settled on ${winningNumber}.`
        );
        return;
    }

    if (
        !activeRound ||
        activeRound.id !== roundId ||
        activeRound.status !== "spinning"
    ) {
        console.warn(
            `Ignoring stale roulette result for Round #${roundId}.`
        );

        return;
    }

    const resolved =
        resolveRound(winningNumber);

    if (!resolved.success) {
        return;
    }

    broadcastOverlayMessage({
        type: "roundResolved",
        roundId: resolved.roundId,
        winningNumber: resolved.winningNumber,
        cooldownEndsAt: resolved.cooldownEndsAt
    });

    await announceResolvedRound(
        resolved,
        sendChatMessage
    );

    hideTableTimer = setTimeout(
        () => {
            broadcastOverlayMessage({
                type: "hideTable",
                roundId: resolved.roundId
            });

            hideTableTimer = null;
        },
        RESULT_DISPLAY_MS
    );
}


// ----------------------------------------------------
// State replay for a freshly connected/reconnected overlay
// ----------------------------------------------------

function getOverlayStateMessages() {
    if (!activeRound) {
        return [];
    }

    const messages = [
        {
            type: "roundStarted",
            roundId: activeRound.id,
            bettingDurationMs:
                activeRound.bettingDurationMs,
            bettingEndsAt:
                activeRound.bettingEndsAt
        }
    ];

    const effectiveClosed =
        activeRound.status !== "betting" ||
        Date.now() >= activeRound.bettingEndsAt;

    if (effectiveClosed) {
        messages.push({
            type: "bettingClosed",
            roundId: activeRound.id
        });
    }

    if (
        activeRound.status === "spinning"
    ) {
        messages.push({
            type: "launchBall",
            roundId: activeRound.id
        });
    }

    return messages;
}

function cancelActiveRound(reason = "Cancelled from the desktop Debug tab.") {
    if (!activeRound) {
        return {
            success: false,
            reason: "no_active_round"
        };
    }

    const round = activeRound;

    clearTimeout(round.closeTimer);
    clearTimeout(round.launchTimer);

    if (hideTableTimer) {
        clearTimeout(hideTableTimer);
        hideTableTimer = null;
    }

    const betCount = round.bets.length;
    const userCount = new Set(
        round.bets.map(bet => bet.userId)
    ).size;

    // Bets are only reserved while a round is active. No stake is
    // removed from the database until resolveRound(), so cancelling
    // here automatically leaves every viewer's balance untouched.
    activeRound = null;
    cooldownEndsAt = 0;

    broadcastOverlayMessage({
        type: "hideTable",
        roundId: round.id
    });

    console.warn(
        `[Debug] Round #${round.id} cancelled. ` +
        `${betCount} bet(s) from ${userCount} viewer(s) released. ` +
        reason
    );

    return {
        success: true,
        roundId: round.id,
        betCount,
        userCount
    };
}


function getActiveRound() {
    return activeRound;
}


module.exports = {
    placeBet,
    resolveRound,
    announceResolvedRound,
    handleOverlayMessage,
    getReservedAmount,
    getAvailableBalance,
    getActiveRound,
    getCooldownRemainingMs,
    getRouletteState,
    getOverlayStateMessages,
    cancelActiveRound
};
