const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const databasePath = path.join(
    __dirname,
    "..",
    "data",
    "roulette.db"
);

const db = new DatabaseSync(databasePath);

const users = db
    .prepare(`
        SELECT
            twitch_user_id,
            username,
            balance,
            created_at,
            last_seen
        FROM users
        ORDER BY username
    `)
    .all();

console.table(users);