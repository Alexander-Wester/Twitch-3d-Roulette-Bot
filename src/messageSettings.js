const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

// ----------------------------------------------------
// Custom chat-message configuration.
//
// Each message type has:
// - enabled: use personality/custom messages when true
// - fallback: simple non-personality message when false
// - messages: editable random message bank
//
// The Electron app stores this as messages.json in AppData.
// The CLI fallback stores it in ./data.
// ----------------------------------------------------

const MESSAGE_DEFINITIONS = Object.freeze({
    cooldown: {
        label: "Cooldown Reply",
        group: "General",
        description: "Sent when someone tries !gamble while the wheel is still on cooldown.",
        placeholders: ["username", "time"],
        fallback: "Please wait for the roulette cooldown to finish.",
        messages: [
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
        ]
    },
    idleReminder: {
        label: "Idle Reminder",
        group: "General",
        description: "Sent after roulette has been idle for the configured reminder interval.",
        placeholders: [],
        fallback: "Roulette is available. Type !gamble to play.",
        messages: [
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
        ]
    },
    bettingClosed: {
        label: "Betting Closed",
        group: "Round",
        description: "Sent when the betting window closes and no more bets are accepted.",
        placeholders: [],
        fallback: "🔒 Betting closed.",
        messages: [
            "🔒 Bets locked. No edits, no refunds, no sudden bursts of common sense.",
            "🔒 Betting closed. You have officially committed to this decision.",
            "🔒 That's it. The wheel now has custody of your chips.",
            "🔒 Bets are locked. Blame physics from this point forward.",
            "🔒 No more bets. Please direct all complaints to the spinning wooden object.",
            "🔒 Betting closed. Regret is now non-refundable.",
            "🔒 Bets locked. The time for rational thought has passed."
        ]
    },
    genericBet: {
        label: "Normal Bet Accepted",
        group: "Bets",
        description: "Used for a normal accepted bet when no more-specific bet reaction applies.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "Bet Accepted! {username} puts {amount} chips on {result}.",
            "{username} commits {amount} chips to {result}. The paperwork is final.",
            "{username}: {amount} on {result}. A completely normal financial decision.",
            "Accepted — {username} has entrusted {amount} chips to {result}."
        ]
    },
    greenBet: {
        label: "Green Bet",
        group: "Bets",
        description: "Used when an accepted bet is placed on green.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on green.",
        messages: [
            "{username} puts {amount} on GREEN. We have located the optimist.",
            "{username} has placed {amount} on GREEN. Intrusive thoughts are winning.",
            "{username} bets {amount} on GREEN. Sensible? No. Interesting? Absolutely.",
            "{username} throws {amount} at GREEN. The wheel respects the audacity."
        ]
    },
    exactBet: {
        label: "Exact Number Bet",
        group: "Bets",
        description: "Used when an accepted bet is placed on one exact number.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username} puts {amount} on {result} with absolutely unjustified confidence.",
            "{username} calls {result} exactly for {amount} chips. Bold strategy.",
            "{username}: {amount} on exactly {result}. Skill has already been claimed.",
            "{username} singles out {result} for {amount} chips. The wheel has been notified."
        ]
    },
    bigBankrollBet: {
        label: "Large Bankroll Bet",
        group: "Bets",
        description: "Used for a bet worth at least 70% of the user's currently available chips.",
        placeholders: ["username", "amount", "result", "wagerPercent"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username} puts {amount} on {result} — about {wagerPercent}% of the available bankroll. Retirement planning is going great.",
            "{username} makes a LARGE commitment: {amount} on {result}.",
            "{username} appears to have confused roulette with a savings account: {amount} on {result}."
        ]
    },
    allInBet: {
        label: "All-In Bet",
        group: "Bets",
        description: "Used when a viewer wagers every chip currently available to them.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username} is ALL IN: {amount} on {result}. There is no Plan B.",
            "{username} just shoved the entire available stack — {amount} chips — onto {result}.",
            "{username} has achieved maximum commitment: ALL IN on {result} for {amount}."
        ]
    },
    multiBet: {
        label: "Multiple Bet",
        group: "Bets",
        description: "Used when the same viewer places another bet in the current round.",
        placeholders: ["username", "amount", "result", "betCount"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username} adds bet #{betCount}: {amount} on {result}. Diversifying the portfolio. Unfortunately, the portfolio is roulette.",
            "{username} is back for bet #{betCount}: {amount} on {result}. Apparently one position wasn't enough.",
            "{username} adds another {amount} chips on {result}. Hedging, chasing, or vibes — impossible to know."
        ]
    },
    revengeBet: {
        label: "Revenge Bet",
        group: "Bets",
        description: "Used when the previous round's biggest loser comes back to bet again.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username} is back after last round's beating: {amount} on {result}. Recovery plan unclear.",
            "{username} returns immediately after being last round's biggest donor. {amount} on {result}.",
            "{username} has chosen revenge: {amount} on {result}. The wheel remembers nothing."
        ]
    },
    hotHandBet: {
        label: "Hot Hand Bet",
        group: "Bets",
        description: "Used when the previous round's biggest winner immediately bets again.",
        placeholders: ["username", "amount", "result"],
        fallback: "Bet Accepted! {username} places {amount} chips on {result}.",
        messages: [
            "{username}, last round's biggest winner, is back with {amount} on {result}. One successful spin has become a system.",
            "{username} won big last round and immediately returns with {amount} on {result}. Confidence is a renewable resource.",
            "{username} is pressing the hot hand: {amount} on {result}. Statistical caution has left the chat."
        ]
    },
    greenResult: {
        label: "Green Result Reveal",
        group: "Results",
        description: "Winning-pocket reveal when the physical wheel lands on zero.",
        placeholders: ["number", "color"],
        fallback: "GREEN {number}",
        messages: [
            "🟢 GREEN {number} — THERE IT IS.",
            "🟢 GREEN {number} — the forbidden vegetable.",
            "🟢 GREEN {number} — everyone who didn't bet green may begin complaining.",
            "🟢 GREEN {number} — the wheel chose violence.",
            "🟢 GREEN {number} — whoever bet green is unbearable for the next five minutes."
        ]
    },
    normalResult: {
        label: "Normal Result Reveal",
        group: "Results",
        description: "Winning-pocket reveal for red or black numbers.",
        placeholders: ["number", "color"],
        fallback: "{color} {number}",
        messages: [
            "{color} {number} — the wheel has spoken.",
            "{color} {number} — physics has selected its victims.",
            "{color} {number} — congratulations to some of you. Condolences to the rest.",
            "{color} {number} — the machine has rendered judgment.",
            "{color} {number}. Absolutely nothing can be done about this now.",
            "{color} {number} — complaints may be filed directly with the ball."
        ]
    },
    greenHit: {
        label: "Green Hit",
        group: "Results",
        description: "Special callout when one or more viewers win a green bet.",
        placeholders: ["names"],
        fallback: "🟢 GREEN HIT! {names} won a green bet.",
        messages: [
            "🟢 GREEN HIT! {names} actually listened to the intrusive thoughts.",
            "🟢 GREEN HIT! {names} cashed the green bet. Please do not encourage this.",
            "🟢 GREEN HIT! {names} found the tiny green exit.",
            "🟢 GREEN HIT! {names} will now be unbearable for approximately five minutes."
        ]
    },
    straightHit: {
        label: "Straight-Up Hit",
        group: "Results",
        description: "Special callout when one or more viewers hit an exact-number bet.",
        placeholders: ["names"],
        fallback: "🎯 STRAIGHT-UP HIT! {names} won a single-number bet.",
        messages: [
            "🎯 {names} HIT THE EXACT NUMBER. Please do not encourage them.",
            "🎯 STRAIGHT-UP HIT! {names} just got paid 35:1 for that nonsense.",
            "🎯 EXACT NUMBER. {names} has been rewarded for behaviour we specifically should not reinforce.",
            "🎯 {names} called it exactly. Skill has been claimed; evidence remains inconclusive."
        ]
    },
    houseSweep: {
        label: "House Sweep",
        group: "Results",
        description: "Used in compact-result mode when nobody finishes the round with a net win.",
        placeholders: [],
        fallback: "🏆 Biggest winner: nobody.",
        messages: [
            "🏆 Biggest winner: nobody. Perfect round for the house.",
            "🏆 Nobody won. The house would like to thank you all for your generous contributions.",
            "🏆 House sweep. Every chip lost today goes toward essential wheel maintenance.",
            "🏆 No winners. The wheel remains financially undefeated."
        ]
    },
    nobodyLost: {
        label: "Nobody Lost",
        group: "Results",
        description: "Used in compact-result mode when nobody finishes the round with a net loss.",
        placeholders: [],
        fallback: "Nobody lost this round.",
        messages: [
            "Nobody Lost! Somehow everyone survived. Accounting has been notified.",
            "Nobody Lost! The house is broke!",
            "Nobody Lost! A deeply suspicious round.",
            "Nobody Lost! The wheel will be reviewing what went wrong."
        ]
    },
    resultPrompt: {
        label: "Result Prompt",
        group: "Results",
        description: "Prompt shown after compact round results to remind viewers about !result.",
        placeholders: [],
        fallback: "Type !result to see your result.",
        messages: [
            "Want to see your result? Type !result",
            "Need the damage report? Type !result",
            "For your personal financial autopsy, type !result",
            "Type !result if you need exact confirmation of what just happened to your chips."
        ]
    },
    userBreakEven: {
        label: "Individual Break Even",
        group: "Individual Results",
        description: "Show-all-results message when a viewer finishes exactly even.",
        placeholders: ["username"],
        fallback: "➖ {username} broke even (0 chips).",
        messages: [
            "➖ {username} broke even. The wheel has declined to form an opinion."
        ]
    },
    userWinNormal: {
        label: "Individual Win",
        group: "Individual Results",
        description: "Show-all-results message for a normal net win that is not the round's biggest win.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "✅ {username} won {signedAmount} chips.",
        messages: [
            "✅ {username} wins {signedAmount} chips. The system works, apparently.",
            "✅ {username} finishes {signedAmount} chips up. Dangerous reinforcement.",
            "✅ {username} takes {signedAmount} chips from the wheel."
        ]
    },
    userWinHuge: {
        label: "Individual Huge Win",
        group: "Individual Results",
        description: "Show-all-results message for a non-top win of at least 5,000 chips.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "✅ {username} won {signedAmount} chips.",
        messages: [
            "✅ {username} walks away {signedAmount} chips richer and considerably more confident than they should be."
        ]
    },
    userTopWinner: {
        label: "Individual Top Winner",
        group: "Individual Results",
        description: "Show-all-results message for the round's biggest winner below 5,000 chips.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "🏆 {username} won {signedAmount} chips.",
        messages: [
            "🏆 {username} leads the table with {signedAmount} chips. Suspiciously competent."
        ]
    },
    userTopWinnerHuge: {
        label: "Individual Huge Top Winner",
        group: "Individual Results",
        description: "Show-all-results message for the round's biggest winner at 5,000 chips or more.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "🏆 {username} won {signedAmount} chips.",
        messages: [
            "🏆 {username} extracts {signedAmount} chips from the machine. Security has been informed."
        ]
    },
    userBankrupt: {
        label: "Individual Bankrupt",
        group: "Individual Results",
        description: "Show-all-results message when a losing viewer reaches exactly zero chips.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "💀 {username} lost {signedAmount} chips and now has 0 chips.",
        messages: [
            "💀 {username} has achieved financial zero: {signedAmount} chips."
        ]
    },
    userLossNormal: {
        label: "Individual Loss",
        group: "Individual Results",
        description: "Show-all-results message for a normal net loss that is not the round's biggest loss.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "❌ {username} lost {signedAmount} chips.",
        messages: [
            "❌ {username} loses {signedAmount} chips. A manageable amount of character development.",
            "❌ {username} finishes {signedAmount} chips down. The wheel appreciates the donation.",
            "❌ {username} loses {signedAmount} chips. Unfortunate, but extremely on brand for roulette."
        ]
    },
    userLossHuge: {
        label: "Individual Huge Loss",
        group: "Individual Results",
        description: "Show-all-results message for a non-top loss of at least 5,000 chips.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "❌ {username} lost {signedAmount} chips.",
        messages: [
            "❌ {username} loses {signedAmount} chips. A generous contribution to ongoing wheel maintenance."
        ]
    },
    userTopLoser: {
        label: "Individual Top Loser",
        group: "Individual Results",
        description: "Show-all-results message for the round's biggest loss below 5,000 chips.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "💀 {username} lost {signedAmount} chips.",
        messages: [
            "💀 {username} leads the losses at {signedAmount} chips. Character development acquired."
        ]
    },
    userTopLoserHuge: {
        label: "Individual Huge Top Loser",
        group: "Individual Results",
        description: "Show-all-results message for the round's biggest loss at 5,000 chips or more.",
        placeholders: ["username", "signedAmount", "amount"],
        fallback: "💀 {username} lost {signedAmount} chips.",
        messages: [
            "💀 {username} donates {amount} chips. We will be naming a wing of the casino after them."
        ]
    },
    biggestWinner: {
        label: "Compact Biggest Winner",
        group: "Compact Results",
        description: "Compact-result mode message for the biggest winner below 5,000 chips.",
        placeholders: ["names", "signedAmount", "winnerLabel", "eachSuffix", "count"],
        fallback: "🏆 Biggest {winnerLabel}: {names} {signedAmount} chips{eachSuffix}.",
        messages: [
            "🏆 Biggest {winnerLabel}: {names} {signedAmount} chips{eachSuffix}. Suspiciously competent."
        ]
    },
    biggestWinnerHuge: {
        label: "Compact Huge Winner",
        group: "Compact Results",
        description: "Compact-result mode message for the biggest winner at 5,000 chips or more.",
        placeholders: ["names", "namesDisplay", "signedAmount", "count"],
        fallback: "🏆 {namesDisplay} won {signedAmount} chips.",
        messages: [
            "🏆 {namesDisplay} extracts {signedAmount} chips from the machine. Security has been informed."
        ]
    },
    biggestLoser: {
        label: "Compact Biggest Loser",
        group: "Compact Results",
        description: "Compact-result mode message for the biggest loss below 5,000 chips.",
        placeholders: ["names", "signedAmount", "loserLabel", "eachSuffix", "count"],
        fallback: "💀 Biggest {loserLabel}: {names} {signedAmount} chips{eachSuffix}.",
        messages: [
            "💀 Biggest {loserLabel}: {names} {signedAmount} chips{eachSuffix}. Character development acquired."
        ]
    },
    biggestLoserHuge: {
        label: "Compact Huge Loser",
        group: "Compact Results",
        description: "Compact-result mode message for the biggest loss at 5,000 chips or more.",
        placeholders: ["names", "namesDisplay", "amount", "count"],
        fallback: "💀 {namesDisplay} lost {amount} chips.",
        messages: [
            "💀 {namesDisplay} donates {amount} chips. We will be naming a wing of the casino after them."
        ]
    }
});

function createDefaultState() {
    const categories = {};

    for (const [key, definition] of Object.entries(MESSAGE_DEFINITIONS)) {
        categories[key] = {
            enabled: true,
            messages: [...definition.messages]
        };
    }

    return { categories };
}

let storageDir = path.join(process.cwd(), "data");
let cachedState = null;
const events = new EventEmitter();

function getMessagesPath() {
    return path.join(storageDir, "messages.json");
}

function ensureStorageDirectory() {
    fs.mkdirSync(storageDir, { recursive: true });
}

function writeState(state) {
    ensureStorageDirectory();

    const target = getMessagesPath();
    const temporary = `${target}.tmp`;

    fs.writeFileSync(
        temporary,
        JSON.stringify(state, null, 2),
        "utf8"
    );

    try {
        fs.renameSync(temporary, target);
    } catch (error) {
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
        }
        fs.renameSync(temporary, target);
    }
}

function sanitizeState(raw) {
    const defaults = createDefaultState();
    const result = createDefaultState();

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return result;
    }

    for (const key of Object.keys(MESSAGE_DEFINITIONS)) {
        const candidate = raw.categories?.[key];

        if (!candidate || typeof candidate !== "object") {
            continue;
        }

        if (typeof candidate.enabled === "boolean") {
            result.categories[key].enabled = candidate.enabled;
        }

        if (Array.isArray(candidate.messages)) {
            result.categories[key].messages = candidate.messages
                .filter(message => typeof message === "string")
                .map(message => message.trim())
                .filter(message => message.length > 0)
                .slice(0, 250);
        }
    }

    // defaults is intentionally referenced so future migrations can use it
    // without changing the shape of this function.
    void defaults;

    return result;
}

function loadState() {
    ensureStorageDirectory();
    const file = getMessagesPath();

    if (!fs.existsSync(file)) {
        const defaults = createDefaultState();
        writeState(defaults);
        return defaults;
    }

    try {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        const state = sanitizeState(raw);
        writeState(state);
        return state;
    } catch (error) {
        console.error(
            "[Messages] Could not read messages.json; restoring defaults:",
            error.message
        );

        try {
            fs.renameSync(file, `${file}.invalid-${Date.now()}`);
        } catch {
            // Defaults below will still replace a malformed file.
        }

        const defaults = createDefaultState();
        writeState(defaults);
        return defaults;
    }
}

function getState() {
    if (!cachedState) {
        cachedState = loadState();
    }

    return JSON.parse(JSON.stringify(cachedState));
}

function getEditorState() {
    const state = getState();

    return {
        categories: Object.fromEntries(
            Object.entries(MESSAGE_DEFINITIONS).map(([key, definition]) => [
                key,
                {
                    key,
                    label: definition.label,
                    group: definition.group,
                    description: definition.description,
                    placeholders: [...definition.placeholders],
                    fallback: definition.fallback,
                    enabled: state.categories[key].enabled,
                    messages: [...state.categories[key].messages]
                }
            ])
        )
    };
}

function validateCategoryUpdate(key, candidate) {
    if (!MESSAGE_DEFINITIONS[key]) {
        throw new Error(`Unknown message type: ${key}`);
    }

    if (!candidate || typeof candidate !== "object") {
        throw new Error("Message type settings must be an object.");
    }

    if (typeof candidate.enabled !== "boolean") {
        throw new Error("Custom messages enabled must be true or false.");
    }

    if (!Array.isArray(candidate.messages)) {
        throw new Error("Messages must be a list.");
    }

    if (candidate.messages.length > 250) {
        throw new Error("A message type can contain at most 250 messages.");
    }

    const messages = candidate.messages.map(message => {
        if (typeof message !== "string") {
            throw new Error("Every custom message must be text.");
        }

        const trimmed = message.trim();

        if (!trimmed) {
            throw new Error("Custom messages cannot be blank. Delete blank rows instead.");
        }

        if (trimmed.length > 450) {
            throw new Error("Custom messages must be 450 characters or fewer.");
        }

        return trimmed;
    });

    return {
        enabled: candidate.enabled,
        messages
    };
}

function saveCategory(key, candidate) {
    const state = getState();
    const normalized = validateCategoryUpdate(key, candidate);

    state.categories[key] = normalized;
    cachedState = state;
    writeState(state);

    events.emit("changed", getEditorState(), [key]);
    console.log(`[Messages] Updated ${MESSAGE_DEFINITIONS[key].label}.`);

    return getEditorState();
}



function saveGroupEnabled(group, enabled) {
    if (typeof group !== "string" || !group.trim()) {
        throw new Error("Message section name is required.");
    }

    if (typeof enabled !== "boolean") {
        throw new Error("Message section enabled must be true or false.");
    }

    const matchingKeys = Object.entries(MESSAGE_DEFINITIONS)
        .filter(([, definition]) => definition.group === group)
        .map(([key]) => key);

    if (matchingKeys.length === 0) {
        throw new Error(`Unknown message section: ${group}`);
    }

    const state = getState();

    for (const key of matchingKeys) {
        state.categories[key].enabled = enabled;
    }

    cachedState = state;
    writeState(state);

    events.emit(
        "changed",
        getEditorState(),
        matchingKeys
    );

    console.log(
        `[Messages] Turned ${group} custom messages ${enabled ? "ON" : "OFF"}.`
    );

    return getEditorState();
}

function restoreDefaults() {
    cachedState = createDefaultState();
    writeState(cachedState);

    const keys = Object.keys(MESSAGE_DEFINITIONS);
    events.emit("changed", getEditorState(), keys);
    console.log("[Messages] Restored all default message banks.");

    return getEditorState();
}

function setMessageStorageDir(directory) {
    if (!directory) {
        throw new Error("Message storage directory is required.");
    }

    storageDir = directory;
    cachedState = null;
    return getState();
}

function renderTemplate(template, context = {}) {
    return String(template).replace(
        /\{([A-Za-z0-9_]+)\}/g,
        (match, key) => {
            if (!Object.prototype.hasOwnProperty.call(context, key)) {
                return match;
            }

            const value = context[key];
            return value === null || value === undefined
                ? ""
                : String(value);
        }
    );
}

function pickMessage(key, context = {}) {
    const definition = MESSAGE_DEFINITIONS[key];

    if (!definition) {
        throw new Error(`Unknown message type: ${key}`);
    }

    const state = getState().categories[key];
    const bank = state.enabled && state.messages.length > 0
        ? state.messages
        : [definition.fallback];

    const template = bank[
        Math.floor(Math.random() * bank.length)
    ];

    return renderTemplate(template, context);
}

function onMessagesChanged(listener) {
    events.on("changed", listener);
    return () => events.off("changed", listener);
}

module.exports = {
    MESSAGE_DEFINITIONS,
    getEditorState,
    saveCategory,
    saveGroupEnabled,
    restoreDefaults,
    setMessageStorageDir,
    getMessagesPath,
    pickMessage,
    renderTemplate,
    onMessagesChanged
};
