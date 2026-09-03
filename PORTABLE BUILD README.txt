RHINO'S ROULETTE BOT v1.5.0
PORTABLE WINDOWS BUILD

FOR ALEX / THE DEVELOPER
========================

1. Extract this build-kit ZIP to a normal folder.
2. Double-click:
       BUILD PORTABLE.bat
3. The first build needs:
       - Windows 10/11 x64
       - Node.js 22 or newer
       - Internet access
4. The builder installs dependencies, creates the Electron app,
   and then creates:

       dist\Rhinos-Roulette-Bot-v1.5.0-win64.zip

That final ZIP is the one to send to the streamer.

The streamer's PC DOES NOT need Node.js, npm, Electron, or Python.


STREAMER FIRST RUN
==================

1. Extract Rhinos-Roulette-Bot-v1.5.0-win64.zip.
2. Run:
       Rhinos Roulette Bot.exe
3. Connect the Broadcaster Twitch account.
4. Connect the Twitch bot account.
5. Make the bot account a moderator if needed.
6. Add this OBS Browser Source:
       http://localhost:3000/overlay
   Recommended size:
       1920 x 1080


FUTURE LAUNCHES
===============

Normally just run Rhinos Roulette Bot.exe.

OAuth tokens automatically refresh during normal use.


UPDATES / PATCHES
=================

Viewer balances and history are NOT stored in the portable program folder.
Neither are Twitch authorizations, Settings, custom Messages or Logs.

They live in the current Windows user's AppData folder.

That means a future program-folder replacement does not wipe the streamer's:
- chip balances
- roulette result history
- Twitch account connections
- settings
- custom messages
- logs


WINDOWS WARNING
===============

This alpha build is not code-signed. Windows SmartScreen may warn that
the publisher is unknown. That is expected for this private test build.

Do not distribute any .env file, token JSON file, refresh token, password,
or client secret with the portable app.
