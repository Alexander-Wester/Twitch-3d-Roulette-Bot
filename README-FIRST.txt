RHINO'S ROULETTE BOT - PHASE 3 LOGS & DEBUG
============================================

THIS BUILD
----------
Version: 1.3.0

This update is built directly on top of the Phase 2 Settings UI.
Setup, OAuth refresh, settings, roulette personality, passive income,
and the OBS overlay remain in place.

NEW: LOGS TAB
-------------
The desktop app now keeps a live backend log view with:
- All / Info / Warning / Error filters
- Text search
- Auto-scroll
- Clear View (does not delete the saved file)
- Copy Visible
- Open Log Folder

Backend console.log / console.warn / console.error output is captured automatically,
so existing Twitch, roulette, passive-income, auth, and overlay-server messages appear
without rewriting every source file.

Daily log files are written to:

Electron userData/logs/roulettebot-YYYY-MM-DD.log

OAuth-style access_token, refresh_token, Authorization Bearer/OAuth, and client_secret
values are redacted before a line is written to disk.

NEW: DEBUG TAB
--------------
The Debug page includes live diagnostics for:
- Twitch connection state
- Current roulette lifecycle state
- Current round bet/viewer count
- Overlay server status and connected Browser Source count
- Application / Electron / Node version

DEBUG ACTIONS
-------------
Twitch:
- Reconnect Twitch EventSub without restarting the whole app
- Send a live test message through the connected bot account

OBS overlay:
- Show Table
- Hide Table
- Run Test Spin

Test Spin uses the real wheel physics but uses a negative debug round ID.
Its physical result is deliberately ignored by roundManager, so it:
- does not create or resolve a real round
- does not change balances
- does not post a result in Twitch chat

Round recovery:
- Cancel Active Round

IMPORTANT: Roulette bets are reserved in memory until resolveRound(). They are not
removed from the database when placed. Therefore cancelling an active round releases
all pending bets without needing a balance refund. The bot posts a cancellation notice
in Twitch chat.

Developer / support tools:
- Copy Diagnostics
- Open App Data Folder
- Open Log Folder
- Open Developer Tools
- Restart RouletteBot

COPY DIAGNOSTICS
----------------
Copy Diagnostics intentionally includes only useful non-secret state such as:
- app/platform versions
- connected account names/status
- Twitch runtime status
- roulette state
- overlay status
- current settings

It does NOT include OAuth access tokens or refresh tokens.

PHASE 2 SETTINGS STILL AVAILABLE
--------------------------------
Economy:
- Starting chips (default 1,000)
- Minimum bet (default 100)
- Passive income enabled / disabled
- Passive income amount (default 200)
- Passive income interval (default 5 minutes)

Round timing:
- Betting timer minimum (default 20 seconds)
- Betting timer maximum (default 22 seconds)
- Roulette cooldown (default 5 minutes)

Chat:
- Idle gamble reminders enabled / disabled
- Idle reminder interval (default 20 minutes)
- Show every user's result enabled / disabled

WHERE LOCAL DATA IS SAVED
-------------------------
Twitch OAuth files:
Electron userData/auth/

Settings:
Electron userData/settings.json

Logs:
Electron userData/logs/

The existing roulette database still follows the project's current database.js behavior
and remains in the project's ignored data/ folder for now.

OBS
---
Overlay URL:

http://localhost:3000/overlay

Recommended Browser Source size:
1920 x 1080

RUNNING THE APP
---------------
There are no new npm dependencies in Phase 3.

If dependencies are already installed:

npm start

For a fresh checkout:

npm install
npm start

GITHUB / PRIVATE DATA
---------------------
Keep these ignored:

node_modules/
.env
tokens.json
*.tokens.json
data/
roulette.db
dist/

The public Twitch Client ID remains in src/appConfig.js.
Never commit Twitch passwords, access tokens, refresh tokens, or a Client Secret.
