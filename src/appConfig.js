// appConfig.js
//
// Public application configuration that is safe to ship with RouletteBot.
//
// IMPORTANT:
// Twitch Client IDs are public identifiers and can safely be included here.
// NEVER put a Twitch Client Secret, OAuth access token, refresh token,
// password, or any other private credential in this file.

const TWITCH_CLIENT_ID = "w7vt9fd7hfllpwzbfz6v883dl8d631";

const OVERLAY_PORT = 3000;
const OVERLAY_URL = `http://localhost:${OVERLAY_PORT}/overlay`;

function hasTwitchClientId() {
    return Boolean(
        TWITCH_CLIENT_ID &&
        TWITCH_CLIENT_ID !== "PASTE_YOUR_TWITCH_CLIENT_ID_HERE"
    );
}

module.exports = {
    TWITCH_CLIENT_ID,
    OVERLAY_PORT,
    OVERLAY_URL,
    hasTwitchClientId
};
