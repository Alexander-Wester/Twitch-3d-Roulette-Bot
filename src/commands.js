const MIN_BET = 100;

const NAMED_RESULTS = new Set([
    "odd",
    "even",
    "red",
    "black",
    "green"
]);

const { getBalance } = require("./database");

const {
    placeBet,
    resolveRound,
    getReservedAmount,
    getAvailableBalance
} = require("./roundManager");


// ----------------------------------------------------
// !gamble help message
// ----------------------------------------------------

function gambleGuide() {
    return (
        "Usage: !gamble <result> <bet amount> | " +
        "Result: odd, even, red, black, green, or a number 0-36. | " +
        "Minimum bet: 100. Maximum bet: your available balance. " +
        "Example: !gamble red 250"
    );
}


// ----------------------------------------------------
// Validate roulette selection
// ----------------------------------------------------

function validResult(result) {
    result = result.toLowerCase();

    // Named bets
    if (NAMED_RESULTS.has(result)) {
        return true;
    }

    // Exact number from 0 through 36
    if (/^\d+$/.test(result)) {
        const number = Number(result);

        return number >= 0 && number <= 36;
    }

    return false;
}


// ----------------------------------------------------
// Main command handler
// ----------------------------------------------------

async function handleCommand(event, sendChatMessage) {
    const username = event.chatter_user_name;
    const userId = event.chatter_user_id;

    const fullMessage = event.message.text.trim();

    // Example:
    //
    // !gamble red 250
    //
    // becomes:
    //
    // ["!gamble", "red", "250"]

    const parts = fullMessage.split(/\s+/);

    const command = parts[0].toLowerCase();


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
    // !gamble
    // ====================================================

    if (command === "!gamble") {

        // We expect exactly:
        //
        // !gamble <result> <amount>
        //
        // Example:
        //
        // !gamble red 500

        if (parts.length !== 3) {
            await sendChatMessage(
                gambleGuide()
            );

            return;
        }


        // ------------------------------------------------
        // Read command variables
        // ------------------------------------------------

        const result =
            parts[1].toLowerCase();

        // Allows:
        //
        // 1000
        // 1,000

        const amountText =
            parts[2].replace(/,/g, "");

        const betAmount =
            Number(amountText);


        // ------------------------------------------------
        // Validate roulette result
        // ------------------------------------------------

        if (!validResult(result)) {
            await sendChatMessage(
                gambleGuide()
            );

            return;
        }


        // ------------------------------------------------
        // Validate bet amount
        // ------------------------------------------------

        if (
            !Number.isFinite(betAmount) ||
            !Number.isInteger(betAmount)
        ) {
            await sendChatMessage(
                `${username}, your bet must be a whole number. ` +
                `The minimum bet is ${MIN_BET} chips.`
            );

            return;
        }


        if (betAmount < MIN_BET) {
            await sendChatMessage(
                `${username}, the minimum bet is ` +
                `${MIN_BET.toLocaleString()} chips.`
            );

            return;
        }


        // This accounts for money the user has already
        // wagered during the current round.

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


        // ------------------------------------------------
        // Actually place the bet
        // ------------------------------------------------

        const bet = placeBet(
            userId,
            username,
            result,
            betAmount,
            sendChatMessage
        );


        // Round exists, but its betting window closed.
        if (
            !bet.success &&
            bet.reason === "betting_closed"
        ) {
            await sendChatMessage(
                `${username}, betting for the current round is closed.`
            );

            return;
        }


        // Extra safety check.
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


        // Catch anything unexpected.
        if (!bet.success) {
            await sendChatMessage(
                `${username}, your bet could not be accepted.`
            );

            return;
        }


        // ------------------------------------------------
        // Successful bet
        // ------------------------------------------------

        await sendChatMessage(
            `Bet Accepted! ${username} places a bet of ` +
            `${betAmount.toLocaleString()} chips on ${result}.`
        );

        return;
    }


    // ====================================================
    // !resolve
    //
    // TEMPORARY development command.
    //
    // Eventually the 3D roulette wheel will call
    // resolveRound() instead.
    // ====================================================

    if (command === "!resolve") {

        // Only allow the streamer whose channel is
        // configured in .env to resolve the wheel.

        const channelLogin =
            process.env.TWITCH_CHANNEL
                ?.toLowerCase();

        const chatterLogin =
            event.chatter_user_login
                ?.toLowerCase();


        if (chatterLogin !== channelLogin) {
            return;
        }


        // Expected:
        //
        // !resolve 17

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


        // ------------------------------------------------
        // Settle the round
        // ------------------------------------------------

        const resolved =
            resolveRound(winningNumber);


        if (!resolved.success) {
            await sendChatMessage(
                "There is no active roulette round."
            );

            return;
        }


        await sendChatMessage(
            `Roulette result: ${winningNumber}!`
        );


        // Find winning bets.
        const winners =
            resolved.results.filter(
                result => result.won
            );


        if (winners.length === 0) {
            await sendChatMessage(
                "No winning bets this round."
            );

            return;
        }


        // Announce each winner.
        for (const winner of winners) {
            await sendChatMessage(
                `${winner.username} wins ` +
                `${winner.balanceChange.toLocaleString()} chips! ` +
                `New balance: ${winner.newBalance.toLocaleString()}.`
            );
        }

        return;
    }
}


module.exports = {
    handleCommand
};