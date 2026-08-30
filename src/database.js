const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const STARTING_BALANCE = 1000;

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
        balance INTEGER NOT NULL DEFAULT ${STARTING_BALANCE},
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        STARTING_BALANCE
    );

    console.log(
        `New player created: ${username} (${STARTING_BALANCE} chips)`
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


module.exports = {
    getOrCreateUser,
    getBalance,
    changeBalance,
    setBalance,
    STARTING_BALANCE
};