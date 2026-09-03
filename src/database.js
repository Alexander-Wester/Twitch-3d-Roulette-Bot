const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const {
    getSettings,
    DEFAULT_SETTINGS
} = require("./settings");

// Make sure /data exists.
const dataDirectory = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(
    dataDirectory,
    "roulette.db"
);

// Opening this file automatically creates it if needed.
const db = new DatabaseSync(databasePath);


// ----------------------------------------------------
// Create database tables
// ----------------------------------------------------

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        twitch_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT ${DEFAULT_SETTINGS.startingBalance},
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);


db.exec(`
    CREATE TABLE IF NOT EXISTS roulette_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        round_id INTEGER NOT NULL,
        twitch_user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        winning_number INTEGER NOT NULL,
        total_wagered INTEGER NOT NULL,
        balance_change INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        bet_details TEXT NOT NULL,
        resolved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (round_id, twitch_user_id)
    );
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_roulette_results_user
    ON roulette_results (
        twitch_user_id,
        id DESC
    );
`);


// ----------------------------------------------------
// Get a user.
//
// If they don't exist yet, automatically create them.
// ----------------------------------------------------

function getOrCreateUser(userId, username) {
    const existingUser = db
        .prepare(`
            SELECT *
            FROM users
            WHERE twitch_user_id = ?
        `)
        .get(userId);

    if (existingUser) {
        // Update their username in case they changed it on Twitch.
        db.prepare(`
            UPDATE users
            SET
                username = ?,
                last_seen = CURRENT_TIMESTAMP
            WHERE twitch_user_id = ?
        `).run(username, userId);

        return db
            .prepare(`
                SELECT *
                FROM users
                WHERE twitch_user_id = ?
            `)
            .get(userId);
    }


    // New player
    const startingBalance =
        getSettings().startingBalance;

    db.prepare(`
        INSERT INTO users (
            twitch_user_id,
            username,
            balance
        )
        VALUES (?, ?, ?)
    `).run(
        userId,
        username,
        startingBalance
    );

    console.log(
        `New player created: ${username} (${startingBalance} chips)`
    );

    return db
        .prepare(`
            SELECT *
            FROM users
            WHERE twitch_user_id = ?
        `)
        .get(userId);
}


// ----------------------------------------------------
// Get balance
// ----------------------------------------------------

function getBalance(userId, username) {
    const user = getOrCreateUser(
        userId,
        username
    );

    return user.balance;
}


// ----------------------------------------------------
// Change a user's balance
//
// Examples:
// changeBalance(id, name, -250)
// changeBalance(id, name, 500)
// ----------------------------------------------------

function changeBalance(userId, username, amount) {
    getOrCreateUser(userId, username);

    db.prepare(`
        UPDATE users
        SET
            balance = balance + ?,
            username = ?,
            last_seen = CURRENT_TIMESTAMP
        WHERE twitch_user_id = ?
    `).run(
        amount,
        username,
        userId
    );

    return getBalance(userId, username);
}


// ----------------------------------------------------
// Set balance directly
// ----------------------------------------------------

function setBalance(userId, username, amount) {
    getOrCreateUser(userId, username);

    db.prepare(`
        UPDATE users
        SET
            balance = ?,
            username = ?,
            last_seen = CURRENT_TIMESTAMP
        WHERE twitch_user_id = ?
    `).run(
        amount,
        username,
        userId
    );

    return amount;
}


// ----------------------------------------------------
// Store one user's completed roulette-round result.
//
// One row is stored per user per round, even if that
// user placed several bets during the same spin.
// ----------------------------------------------------

function saveRouletteResult({
    roundId,
    userId,
    username,
    winningNumber,
    bets,
    totalWagered,
    balanceChange,
    balanceAfter
}) {
    db.prepare(`
        INSERT INTO roulette_results (
            round_id,
            twitch_user_id,
            username,
            winning_number,
            total_wagered,
            balance_change,
            balance_after,
            bet_details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(round_id, twitch_user_id)
        DO UPDATE SET
            username = excluded.username,
            winning_number = excluded.winning_number,
            total_wagered = excluded.total_wagered,
            balance_change = excluded.balance_change,
            balance_after = excluded.balance_after,
            bet_details = excluded.bet_details,
            resolved_at = CURRENT_TIMESTAMP
    `).run(
        roundId,
        userId,
        username,
        winningNumber,
        totalWagered,
        balanceChange,
        balanceAfter,
        JSON.stringify(bets)
    );
}


// ----------------------------------------------------
// Get a user's most recently completed roulette result
// ----------------------------------------------------

function getLastRouletteResult(userId) {
    const row = db
        .prepare(`
            SELECT
                round_id,
                twitch_user_id,
                username,
                winning_number,
                total_wagered,
                balance_change,
                balance_after,
                bet_details,
                resolved_at
            FROM roulette_results
            WHERE twitch_user_id = ?
            ORDER BY resolved_at DESC, id DESC
            LIMIT 1
        `)
        .get(userId);

    if (!row) {
        return null;
    }

    let bets = [];

    try {
        bets = JSON.parse(row.bet_details);
    } catch (error) {
        console.warn(
            "Could not parse stored roulette bet details:",
            error.message
        );
    }

    return {
        roundId: row.round_id,
        userId: row.twitch_user_id,
        username: row.username,
        winningNumber: row.winning_number,
        totalWagered: row.total_wagered,
        balanceChange: row.balance_change,
        balanceAfter: row.balance_after,
        bets,
        resolvedAt: row.resolved_at
    };
}


// ----------------------------------------------------
// Return the next round ID that has never been used in
// the stored result history. Round IDs must survive app
// restarts because roulette_results is unique on
// (round_id, twitch_user_id).
// ----------------------------------------------------

function getNextRouletteRoundId() {
    const row = db
        .prepare(`
            SELECT COALESCE(MAX(round_id), 0) AS max_round_id
            FROM roulette_results
            WHERE round_id > 0
        `)
        .get();

    return Number(row?.max_round_id || 0) + 1;
}


// ----------------------------------------------------
// Current-chip leaderboard
// ----------------------------------------------------

function getLeaderboard(limit = 5) {
    const safeLimit = Math.max(
        1,
        Math.min(25, Number.isInteger(limit) ? limit : 5)
    );

    return db
        .prepare(`
            SELECT
                twitch_user_id,
                username,
                balance
            FROM users
            ORDER BY
                balance DESC,
                username COLLATE NOCASE ASC
            LIMIT ?
        `)
        .all(safeLimit);
}


module.exports = {
    getOrCreateUser,
    getBalance,
    changeBalance,
    setBalance,
    saveRouletteResult,
    getLastRouletteResult,
    getNextRouletteRoundId,
    getLeaderboard
};
