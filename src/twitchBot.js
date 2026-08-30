require("dotenv").config();

const fs = require("fs");
const WebSocket = require("ws");
const { handleCommand } = require("./commands");

const {
    startOverlayServer
} = require("./overlayServer");

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CHANNEL_LOGIN = process.env.TWITCH_CHANNEL;

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";

let accessToken;
let botUserId;
let botLogin;
let broadcasterUserId;

let websocketSessionId = null;


// ----------------------------------------------------
// Load our saved Twitch token
// ----------------------------------------------------

function loadToken() {
    if (!fs.existsSync("tokens.json")) {
        throw new Error(
            "tokens.json was not found. Run twitchAuth.js first."
        );
    }

    const tokens = JSON.parse(
        fs.readFileSync("tokens.json", "utf8")
    );

    if (!tokens.access_token) {
        throw new Error(
            "tokens.json does not contain an access_token."
        );
    }

    accessToken = tokens.access_token;
}


// ----------------------------------------------------
// Ask Twitch who owns this access token
// ----------------------------------------------------

async function getBotAccount() {
    const response = await fetch(
        "https://id.twitch.tv/oauth2/validate",
        {
            headers: {
                Authorization: `OAuth ${accessToken}`
            }
        }
    );

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `Twitch token validation failed: ${text}`
        );
    }

    const data = await response.json();

    botUserId = data.user_id;
    botLogin = data.login;

    console.log(`Bot account: ${botLogin}`);
    console.log(`Bot user ID: ${botUserId}`);
}


// ----------------------------------------------------
// Convert the channel username into Twitch's numeric ID
// ----------------------------------------------------

async function getBroadcasterAccount() {
    const response = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(CHANNEL_LOGIN)}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": CLIENT_ID
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `Could not look up channel: ${JSON.stringify(data)}`
        );
    }

    if (!data.data || data.data.length === 0) {
        throw new Error(
            `Twitch channel "${CHANNEL_LOGIN}" was not found.`
        );
    }

    broadcasterUserId = data.data[0].id;

    console.log(`Watching channel: ${data.data[0].login}`);
    console.log(`Channel user ID: ${broadcasterUserId}`);
}


// ----------------------------------------------------
// Subscribe our WebSocket to chat messages
// ----------------------------------------------------

async function subscribeToChat() {
    const response = await fetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
            method: "POST",

            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": CLIENT_ID,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                type: "channel.chat.message",
                version: "1",

                condition: {
                    broadcaster_user_id: broadcasterUserId,
                    user_id: botUserId
                },

                transport: {
                    method: "websocket",
                    session_id: websocketSessionId
                }
            })
        }
    );

    const data = await response.json();

    if (response.status !== 202) {
        throw new Error(
            `Could not subscribe to chat: ${JSON.stringify(data)}`
        );
    }

    console.log("Subscribed to Twitch chat!");
}


// ----------------------------------------------------
// Send a Twitch chat message
// ----------------------------------------------------

async function sendChatMessage(message) {
    const response = await fetch(
        "https://api.twitch.tv/helix/chat/messages",
        {
            method: "POST",

            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Client-Id": CLIENT_ID,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                broadcaster_id: broadcasterUserId,
                sender_id: botUserId,
                message
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error(
            "Failed to send chat message:",
            data
        );

        return;
    }

    const result = data.data?.[0];

    if (result?.is_sent) {
        console.log(`BOT -> ${message}`);
    } else {
        console.error(
            "Twitch did not send the message:",
            result?.drop_reason
        );
    }
}


// ----------------------------------------------------
// Handle commands
// ----------------------------------------------------

async function handleChatMessage(event) {
    const username = event.chatter_user_name;
    const message = event.message.text.trim();

    console.log(`[${username}]: ${message}`);

    // Don't respond to ourselves.
    if (event.chatter_user_id === botUserId) {
        return;
    }

    await handleCommand(
        event,
        sendChatMessage
    );
}


// ----------------------------------------------------
// Connect to Twitch EventSub
// ----------------------------------------------------

function connectWebSocket() {
    console.log("\nConnecting to Twitch EventSub...");

    const ws = new WebSocket(EVENTSUB_URL);

    ws.on("open", () => {
        console.log("WebSocket connected.");
        console.log("Waiting for Twitch session...");
    });

    ws.on("message", async rawData => {
        try {
            const data = JSON.parse(rawData.toString());

            const messageType =
                data.metadata?.message_type;

            switch (messageType) {

                // Twitch gives us our WebSocket session ID.
                case "session_welcome":
                    websocketSessionId =
                        data.payload.session.id;

                    console.log(
                        `EventSub session: ${websocketSessionId}`
                    );

                    await subscribeToChat();

                    console.log(
                        "\n========================================"
                    );
                    console.log("RHINO'S ROULETTE BOT IS ONLINE");
                    console.log(
                        "========================================"
                    );
                    console.log(
                        `Watching: ${CHANNEL_LOGIN}`
                    );
                    console.log(
                        "Try typing !hello in Twitch chat."
                    );
                    console.log(
                        "========================================\n"
                    );

                    break;


                // Somebody sent a chat message.
                case "notification":

                    if (
                        data.payload.subscription.type ===
                        "channel.chat.message"
                    ) {
                        await handleChatMessage(
                            data.payload.event
                        );
                    }

                    break;


                // Twitch may tell us to move to a new WebSocket.
                case "session_reconnect":

                    const reconnectUrl =
                        data.payload.session.reconnect_url;

                    console.log(
                        "Twitch requested WebSocket reconnect."
                    );

                    ws.close();

                    connectWebSocketTo(reconnectUrl);

                    break;


                case "revocation":
                    console.error(
                        "Twitch revoked an EventSub subscription:",
                        data.payload.subscription
                    );
                    break;
            }

        } catch (error) {
            console.error(
                "Error processing Twitch message:",
                error
            );
        }
    });

    ws.on("error", error => {
        console.error(
            "WebSocket error:",
            error.message
        );
    });

    ws.on("close", () => {
        console.log("WebSocket disconnected.");
    });
}


// Twitch occasionally provides a special reconnect URL.
function connectWebSocketTo(url) {
    const ws = new WebSocket(url);

    ws.on("message", async rawData => {
        try {
            const data = JSON.parse(rawData.toString());

            if (
                data.metadata?.message_type ===
                "notification" &&
                data.payload.subscription.type ===
                "channel.chat.message"
            ) {
                await handleChatMessage(
                    data.payload.event
                );
            }

        } catch (error) {
            console.error(
                "Reconnect message error:",
                error
            );
        }
    });

    ws.on("error", error => {
        console.error(
            "Reconnect WebSocket error:",
            error.message
        );
    });
}


// ----------------------------------------------------
// Start bot
// ----------------------------------------------------

async function start() {
    console.log("\n========================================");
    console.log("RHINO'S ROULETTE BOT");
    console.log("========================================\n");

    if (!CLIENT_ID) {
        throw new Error(
            "TWITCH_CLIENT_ID is missing from .env"
        );
    }

    if (!CHANNEL_LOGIN) {
        throw new Error(
            "TWITCH_CHANNEL is missing from .env"
        );
    }

    // Start the local OBS / Streamlabs overlay server
    startOverlayServer();

    loadToken();

    await getBotAccount();
    await getBroadcasterAccount();

    connectWebSocket();
}


start().catch(error => {
    console.error("\nERROR:", error.message);
    process.exit(1);
});