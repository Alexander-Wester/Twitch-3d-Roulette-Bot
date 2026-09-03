const NAMED_RESULTS = new Set([
    "odd",
    "even",
    "red",
    "black",
    "green"
]);

const {
    getBalance,
    getLastRouletteResult,
    getLeaderboard
} = require("./database");

const {
    getSettings
} = require("./settings");

const {
    getRandomCooldownLine
} = require("./cooldownLines");

const {
    placeBet,
    resolveRound,
    announceResolvedRound,
    getReservedAmount,
    getAvailableBalance,
    getRouletteState
} = require("./roundManager");


// ----------------------------------------------------
// !gamble help message
// ----------------------------------------------------

function gambleGuide(minimumBet = getSettings().minimumBet) {
    const exampleAmount =
        Math.max(250, minimumBet);

    return (
        "Usage: !gamble <result> <bet amount> | " +
        "Result: odd, even, red, black, green, or a number 0-36. | " +
        `Minimum bet: ${minimumBet.toLocaleString()}. ` +
        "Maximum bet: your available balance. " +
        `Example: !gamble red ${exampleAmount.toLocaleString()} | ` +
        "!GambleCommands for all commands."
    );
}


// ----------------------------------------------------
// Viewer command list
// ----------------------------------------------------

function gambleCommandsResponse(username) {
    return (
        `@${username} Roulette commands: ` +
        "`!gamble <red/black/odd/even/green/0-36> <amount>` | " +
        "`!balance` | `!result` | `!leaderboard` | " +
        "Example: `!gamble red 500`"
    );
}


function leaderboardResponse() {
    const leaders = getLeaderboard(5);

    if (leaders.length === 0) {
        return "🏆 Roulette Leaderboard: nobody has chips yet.";
    }

    const entries = leaders.map(
        (user, index) =>
            `${index + 1}. ${user.username} — ${user.balance.toLocaleString()} chips`
    );

    return `🏆 Roulette Leaderboard: ${entries.join(" | ")}`;
}


// ----------------------------------------------------
// Validate roulette selection
// ----------------------------------------------------

function validResult(result) {
    result = result.toLowerCase();

    if (NAMED_RESULTS.has(result)) {
        return true;
    }

    if (/^\d+$/.test(result)) {
        const number = Number(result);

        return number >= 0 && number <= 36;
    }

    return false;
}


// ----------------------------------------------------
// Friendly cooldown timer
// ----------------------------------------------------

function formatRemainingTime(milliseconds) {
    const totalSeconds = Math.max(
        0,
        Math.ceil(milliseconds / 1000)
    );

    const minutes = Math.floor(
        totalSeconds / 60
    );

    const seconds =
        totalSeconds % 60;

    return (
        `${minutes}:` +
        String(seconds).padStart(2, "0")
    );
}


// ----------------------------------------------------
// Random cooldown response
// ----------------------------------------------------

function cooldownResponse(username, milliseconds) {
    const line = getRandomCooldownLine();
    const remainingTime = formatRemainingTime(milliseconds);

    return (
        `@${username} ${line}\n` +
        `(wheel on cooldown — ${remainingTime} remaining)`
    );
}


// ----------------------------------------------------
// Last roulette result formatting
// ----------------------------------------------------

function formatSignedAmount(amount) {
    if (amount > 0) {
        return `+${amount.toLocaleString()}`;
    }

    if (amount < 0) {
        return `-${Math.abs(amount).toLocaleString()}`;
    }

    return "0";
}


function lastResultResponse(username, lastResult) {
    if (!lastResult) {
        return (
            `@${username} You don't have a roulette result yet. ` +
            `Place a bet with !gamble first.`
        );
    }

    const bets = Array.isArray(lastResult.bets)
        ? lastResult.bets
        : [];

    if (bets.length === 1) {
        const bet = bets[0];

        return (
            `@${username} You bet ${bet.amount.toLocaleString()} on ${bet.result} ` +
            `and ${bet.won ? "WON" : "LOST"} ` +
            `${formatSignedAmount(bet.balanceChange)} chips. ` +
            `Balance: ${lastResult.balanceAfter.toLocaleString()}.`
        );
    }

    const wonBets = bets.filter(bet => bet.won);
    const lostBets = bets.filter(bet => !bet.won);

    const pieces = [];

    if (wonBets.length > 0) {
        pieces.push(
            `won ${wonBets.length} bet${wonBets.length === 1 ? "" : "s"}`
        );
    }

    if (lostBets.length > 0) {
        pieces.push(
            `lost ${lostBets.length} bet${lostBets.length === 1 ? "" : "s"}`
        );
    }

    return (
        `@${username} Last round: ${bets.length} bets, ` +
        `${pieces.join(" and ")}. ` +
        `Net: ${formatSignedAmount(lastResult.balanceChange)} chips. ` +
        `Balance: ${lastResult.balanceAfter.toLocaleString()}.`
    );
}


// ----------------------------------------------------
// Main command handler
// ----------------------------------------------------

async function handleCommand(event, sendChatMessage) {
    const username = event.chatter_user_name;
    const userId = event.chatter_user_id;

    const fullMessage = event.message.text.trim();
    const parts = fullMessage.split(/\s+/);
    const command = parts[0].toLowerCase();


    // ====================================================
    // !gamblecommands
    // ====================================================

    if (command === "!gamblecommands") {
        await sendChatMessage(
            gambleCommandsResponse(username)
        );

        return;
    }


    // ====================================================
    // !leaderboard
    // ====================================================

    if (command === "!leaderboard") {
        await sendChatMessage(
            leaderboardResponse()
        );

        return;
    }


    // ====================================================
    // !balance
    // ====================================================

    if (command === "!balance") {
        const balance = getBalance(
            userId,
            username
        );

        const wagered =
            getReservedAmount(userId);

        const available =
            balance - wagered;

        if (wagered > 0) {
            await sendChatMessage(
                `${username}, you have ${balance.toLocaleString()} chips — ` +
                `${wagered.toLocaleString()} currently wagered, ` +
                `leaving ${available.toLocaleString()} available.`
            );
        } else {
            await sendChatMessage(
                `${username}, your current balance is ` +
                `${balance.toLocaleString()} chips.`
            );
        }

        return;
    }


    // ====================================================
    // !result / !lastbet
    // ====================================================

    if (
        command === "!result" ||
        command === "!lastbet"
    ) {
        const lastResult =
            getLastRouletteResult(userId);

        await sendChatMessage(
            lastResultResponse(
                username,
                lastResult
            )
        );

        return;
    }


    // ====================================================
    // !gamble
    // ====================================================

    if (command === "!gamble") {
        const rouletteState =
            getRouletteState();

        // Read the current setting once for this command so a UI
        // edit cannot change validation halfway through processing.
        const minimumBet =
            getSettings().minimumBet;

        if (
            rouletteState.status ===
            "cooldown"
        ) {
            await sendChatMessage(
                cooldownResponse(
                    username,
                    rouletteState.cooldownRemainingMs
                )
            );

            return;
        }

        if (
            rouletteState.status === "closed" ||
            rouletteState.status === "spinning" ||
            rouletteState.status === "resolving"
        ) {
            await sendChatMessage(
                `@${username} The wheel is already spinning — ` +
                `wait for the result!`
            );

            return;
        }

        if (parts.length !== 3) {
            await sendChatMessage(
                gambleGuide(minimumBet)
            );

            return;
        }

        const result =
            parts[1].toLowerCase();

        const amountText =
            parts[2].replace(/,/g, "");

        const betAmount =
            Number(amountText);

        if (!validResult(result)) {
            await sendChatMessage(
                gambleGuide(minimumBet)
            );

            return;
        }

        if (
            !Number.isFinite(betAmount) ||
            !Number.isInteger(betAmount)
        ) {
            await sendChatMessage(
                `${username}, your bet must be a whole number. ` +
                `The minimum bet is ${minimumBet.toLocaleString()} chips.`
            );

            return;
        }

        if (betAmount < minimumBet) {
            await sendChatMessage(
                `${username}, the minimum bet is ` +
                `${minimumBet.toLocaleString()} chips.`
            );

            return;
        }

        const availableBalance =
            getAvailableBalance(
                userId,
                username
            );

        if (betAmount > availableBalance) {
            await sendChatMessage(
                `${username}, you don't have enough chips for that bet. ` +
                `Your available balance is ` +
                `${availableBalance.toLocaleString()} chips.`
            );

            return;
        }

        const bet = placeBet(
            userId,
            username,
            result,
            betAmount,
            sendChatMessage
        );

        if (
            !bet.success &&
            bet.reason === "cooldown"
        ) {
            await sendChatMessage(
                cooldownResponse(
                    username,
                    bet.cooldownRemainingMs
                )
            );

            return;
        }

        if (
            !bet.success &&
            (
                bet.reason === "closed" ||
                bet.reason === "spinning" ||
                bet.reason === "resolving"
            )
        ) {
            await sendChatMessage(
                `@${username} The wheel is already spinning — ` +
                `wait for the result!`
            );

            return;
        }

        if (
            !bet.success &&
            bet.reason === "insufficient_balance"
        ) {
            await sendChatMessage(
                `${username}, you only have ` +
                `${bet.availableBalance.toLocaleString()} chips ` +
                `available to bet.`
            );

            return;
        }

        if (!bet.success) {
            await sendChatMessage(
                `${username}, your bet could not be accepted.`
            );

            return;
        }

        // roundManager now chooses ONE context-aware personality line.
        // This replaces the old fixed "Bet Accepted!" line rather than
        // adding another message and cluttering chat.
        await sendChatMessage(
            bet.chatMessage ||
            (
                `Bet Accepted! ${username} places a bet of ` +
                `${betAmount.toLocaleString()} chips on ${result}.`
            )
        );

        return;
    }


    // ====================================================
    // !resolve
    //
    // TEMPORARY streamer-only development / emergency command.
    // Normal rounds now resolve automatically from the 3D wheel.
    // ====================================================

    if (command === "!resolve") {
        const channelLogin =
            process.env.TWITCH_CHANNEL
                ?.toLowerCase();

        const chatterLogin =
            event.chatter_user_login
                ?.toLowerCase();

        if (chatterLogin !== channelLogin) {
            return;
        }

        if (parts.length !== 2) {
            await sendChatMessage(
                "Usage: !resolve <0-36>"
            );

            return;
        }

        const winningNumber =
            Number(parts[1]);

        if (
            !Number.isInteger(winningNumber) ||
            winningNumber < 0 ||
            winningNumber > 36
        ) {
            await sendChatMessage(
                "Roulette result must be a whole number from 0-36."
            );

            return;
        }

        const resolved =
            resolveRound(winningNumber);

        if (!resolved.success) {
            await sendChatMessage(
                "There is no active roulette round."
            );

            return;
        }

        await announceResolvedRound(
            resolved,
            sendChatMessage
        );

        return;
    }
}


module.exports = {
    handleCommand
};
