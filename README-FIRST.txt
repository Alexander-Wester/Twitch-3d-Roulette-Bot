RHINO'S ROULETTE BOT - PHASE 1 DESKTOP UI
==========================================

WHAT THIS UPDATE ADDS
---------------------
- Electron desktop setup window.
- Separate Twitch Broadcaster login.
- Separate Twitch Bot login.
- OBS overlay URL + setup instructions.
- Copy URL button.
- Bot /mod command helper.
- Twitch access-token validation and automatic refresh.
- Saved authorizations live in Windows AppData instead of GitHub/project files.
- TWITCH_CHANNEL is no longer needed; the Broadcaster login determines the channel.
- Existing project-root tokens.json can be imported automatically once as the bot login.
- Passive income now asks for the current refreshed Twitch token each payment cycle.

INSTALL INTO YOUR EXISTING PROJECT
----------------------------------
1. Back up your project first.

2. Copy the folders/files from this package into the ROOT of your project:

   desktop/
   src/twitchAuth.js
   src/twitchBot.js
   src/passiveIncome.js
   package.json

   The existing public/, src/database.js, src/commands.js, roulette files, etc.
   stay exactly where they already are.

3. Your .env only needs the Twitch Client ID for this UI:

   TWITCH_CLIENT_ID=your_client_id_here

   TWITCH_CHANNEL can remain for now, but the new desktop app ignores it.
   The Broadcaster Twitch login determines the channel automatically.

4. In a terminal at the project root, run:

   npm install

5. Start the desktop app with:

   npm start

FIRST RUN
---------
1. Click Connect Broadcaster.
   - Authorize with the MAIN STREAMER Twitch account.

2. Click Connect Bot Account.
   - Authorize with the BOT Twitch account.
   - If your old tokens.json is still valid, the app may automatically import it
     as the bot account and you may not need this step on your current PC.

3. Mod the bot account in the broadcaster's chat. The UI gives you the command.

4. Add this Browser Source to OBS:

   http://localhost:3000/overlay

   Width: 1920
   Height: 1080

5. After both Twitch accounts are authorized, RouletteBot starts automatically.

TOKEN / RE-LOGIN BEHAVIOR
-------------------------
Twitch Device Code access tokens are still roughly 4-hour tokens. This update does
NOT try to make an access token live for 30 days. Instead, it does the correct thing:
it automatically uses the refresh token before the access token expires, saves the
new access token, AND saves Twitch's replacement one-time refresh token.

Normal result: you should no longer need to manually log in every ~4 hours.

For Twitch public clients, a refresh token expires after 30 DAYS OF INACTIVITY.
Therefore, if RouletteBot is used regularly, you can remain signed in beyond 30 days.
If the app has not refreshed that authorization for 30 days, Twitch may require one
new login.

WHERE AUTH IS SAVED
-------------------
Electron stores the two Twitch authorization files under the current Windows user's
application data directory, inside the app's userData/auth folder. They are not part
of the GitHub download.

IMPORTANT
---------
- Do not commit tokens.json or any *.tokens.json credentials to GitHub.
- Never put a Twitch Client Secret into this downloadable desktop application.
- Your Twitch Developer Application should be configured as a PUBLIC client for the
  Device Code flow used here.

NEXT PHASE
----------
The Settings tab is intentionally shown as "Coming next". The next update can move
hard-coded values (cooldown, passive income amount/time, starting balance, minimum
bet, idle reminder, show-all-results, etc.) into settings.json and the UI.

RECONNECTING AN ACCOUNT
-----------------------
If RouletteBot is already running and you click Reconnect Broadcaster or Reconnect Bot,
the app will automatically restart itself after the new authorization is saved. This is
intentional so the old Twitch EventSub connection cannot remain attached to the old account.

GITHUB / CLIENT ID NOTE
-----------------------
TWITCH_CLIENT_ID is the public identifier for your registered Twitch application, not a
password or OAuth token. For this first UI pass the app still reads it from .env. Before a
truly zero-setup GitHub release, we can move that one public value into the packaged app so
a downloader does not need to create or edit .env at all.
