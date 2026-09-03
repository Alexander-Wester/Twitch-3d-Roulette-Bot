const WebSocket = require("ws");
const { handleCommand } = require("./commands");

const {
    startPassiveIncome
} = require("./passiveIncome");

const {
    startIdleGambleReminder,
    resetIdleGambleReminder
} = require("./idleGambleReminder");

const {
    startOverlayServer,
    setOverlayMessageHandler,
    setOverlayStateProvider
} = require("./overlayServer");

const {
    handleOverlayMessage,
    getOverlayStateMessages,
    getRouletteState
} = require("./roundManager");

const {
    setAuthStorageDir,
    ensureValidAuth
} = require("./twitchAuth");

const {
    TWITCH_CLIENT_ID: CLIENT_ID,
    hasTwitchClientId
} = require("./appConfig");

const {
    getSettings
} = require("./settings");
const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const AUTH_MAINTENANCE_MS = 60 * 60 * 1000;

let accessToken;
let botUserId;
let botLogin;
let broadcasterUserId;
let broadcasterLogin;

let websocketSessionId = null;
let currentWebSocket = null;
let authMaintenanceTimer = null;
let started = false;
let statusCallback = null;


function emitStatus(status, extra = {}) {
    const payload = {
        status,
        broadcasterLogin,
        botLogin,
        ...extra
    };

    statusCallback?.(payload);
}


async function loadCurrentAuthorizations() {
    const broadcasterAuth =
        await ensureValidAuth("broadcaster");

    const botAuth =
        await ensureValidAuth("bot");

    broadcasterUserId =
        broadcasterAuth.identity.user_id;

    broadcasterLogin =
        broadcasterAuth.identity.login;

    botUserId =
        botAuth.identity.user_id;

    botLogin =
        botAuth.identity.login;

    accessToken =
        botAuth.tokens.access_token;

    return {
        broadcasterAuth,
        botAuth
    };
}


async function refreshBotAuthorization(forceRefresh = false) {
    const auth = await ensureValidAuth(
        "bot",
        { forceRefresh }
    );

    accessToken = auth.tokens.access_token;
    botUserId = auth.identity.user_id;
    botLogin = auth.identity.login;

    return auth;
}


async function getCurrentBotAccessToken() {
    if (!accessToken) {
        await refreshBotAuthorization(false);
    }

    return accessToken;
}


async function fetchAsBot(url, options = {}, retryOnUnauthorized = true) {
    const token = await getCurrentBotAccessToken();

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Client-Id": CLIENT_ID
    };

    const response = await fetch(
        url,
        {
            ...options,
            headers
        }
    );

    if (
        response.status === 401 &&
        retryOnUnauthorized
    ) {
        console.warn(
            "[Twitch Auth] API returned 401. Refreshing bot token and retrying once."
        );

        await refreshBotAuthorization(true);

        return fetchAsBot(
            url,
            options,
            false
        );
    }

    return response;
}


function startAuthMaintenance() {
    if (authMaintenanceTimer) {
        clearInterval(authMaintenanceTimer);
    }

    const maintain = async () => {
        try {
            const botAuth =
                await ensureValidAuth("bot");

            accessToken =
                botAuth.tokens.access_token;

            botUserId =
                botAuth.identity.user_id;

            botLogin =
                botAuth.identity.login;

            // Broadcaster token is not used for every chat API call,
            // but Twitch requires maintained OAuth sessions to be
            // validated regularly too.
            const broadcasterAuth =
                await ensureValidAuth("broadcaster");

            broadcasterUserId =
                broadcasterAuth.identity.user_id;

            broadcasterLogin =
                broadcasterAuth.identity.login;

            if (botAuth.refreshed || broadcasterAuth.refreshed) {
                emitStatus("online", {
                    message: "Twitch authorization refreshed automatically."
                });
            }
        } catch (error) {
            console.error(
                "[Twitch Auth] Maintenance failed:",
                error.message
            );

            emitStatus("auth_required", {
                message: error.message
            });
        }
    };

    authMaintenanceTimer = setInterval(
        maintain,
        AUTH_MAINTENANCE_MS
    );

    authMaintenanceTimer.unref?.();
}


async function subscribeToChat() {
    const response = await fetchAsBot(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
            method: "POST",
            headers: {
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


async function sendChatMessage(message) {
    const response = await fetchAsBot(
        "https://api.twitch.tv/helix/chat/messages",
        {
            method: "POST",
            headers: {
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


async function handleChatMessage(event) {
    const username = event.chatter_user_name;
    const message = event.message.text.trim();

    console.log(`[${username}]: ${message}`);

    if (event.chatter_user_id === botUserId) {
        return;
    }

    const stateBefore =
        getRouletteState();

    await handleCommand(
        event,
        sendChatMessage
    );

    const stateAfter =
        getRouletteState();

    if (
        stateBefore.status === "idle" &&
        stateAfter.status === "betting"
    ) {
        resetIdleGambleReminder();
    }
}


function attachWebSocketHandlers(ws) {
    ws.on("open", () => {
        console.log("WebSocket connected.");
        console.log("Waiting for Twitch session...");

        emitStatus("connecting", {
            message: "Connected to Twitch. Waiting for EventSub session..."
        });
    });

    ws.on("message", async rawData => {
        try {
            const data = JSON.parse(rawData.toString());
            const messageType = data.metadata?.message_type;

            switch (messageType) {
                case "session_welcome":
                    websocketSessionId =
                        data.payload.session.id;

                    console.log(
                        `EventSub session: ${websocketSessionId}`
                    );

                    await subscribeToChat();

                    console.log("\n========================================");
                    console.log("RHINO'S ROULETTE BOT IS ONLINE");
                    console.log("========================================");
                    console.log(`Watching: ${broadcasterLogin}`);
                    console.log(`Speaking as: ${botLogin}`);
                    console.log("========================================\n");

                    emitStatus("online", {
                        message: `Watching ${broadcasterLogin} as ${botLogin}.`
                    });
                    break;

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

                case "session_reconnect": {
                    const reconnectUrl =
                        data.payload.session.reconnect_url;

                    console.log(
                        "Twitch requested WebSocket reconnect."
                    );

                    connectWebSocket(reconnectUrl);
                    break;
                }

                case "revocation":
                    console.error(
                        "Twitch revoked an EventSub subscription:",
                        data.payload.subscription
                    );

                    emitStatus("error", {
                        message: "Twitch revoked the chat subscription."
                    });
                    break;
            }
        } catch (error) {
            console.error(
                "Error processing Twitch message:",
                error
            );

            emitStatus("error", {
                message: error.message
            });
        }
    });

    ws.on("error", error => {
        console.error(
            "WebSocket error:",
            error.message
        );

        emitStatus("error", {
            message: error.message
        });
    });

    ws.on("close", () => {
        if (currentWebSocket === ws) {
            console.log("WebSocket disconnected.");
            emitStatus("disconnected", {
                message: "Twitch EventSub disconnected."
            });
        }
    });
}


function connectWebSocket(url = EVENTSUB_URL) {
    console.log("\nConnecting to Twitch EventSub...");

    const oldSocket = currentWebSocket;
    const ws = new WebSocket(url);

    currentWebSocket = ws;
    attachWebSocketHandlers(ws);

    // For a Twitch-requested reconnect, keep the old socket alive
    // briefly while the replacement connection is established.
    if (
        oldSocket &&
        oldSocket.readyState === WebSocket.OPEN
    ) {
        setTimeout(
            () => {
                try {
                    oldSocket.close();
                } catch {
                    // Nothing to do.
                }
            },
            5000
        ).unref?.();
    }
}


async function startBot(options = {}) {
    if (started) {
        return {
            started: true,
            broadcasterLogin,
            botLogin
        };
    }

    statusCallback =
        typeof options.onStatus === "function"
            ? options.onStatus
            : null;

    if (options.authStorageDir) {
        setAuthStorageDir(options.authStorageDir);
    }

    if (!hasTwitchClientId()) {
        throw new Error(
            "Twitch Client ID is not configured. Set it in src/appConfig.js."
        );
    }

    emitStatus("starting", {
        message: "Starting RouletteBot..."
    });

    console.log("\n========================================");
    console.log("RHINO'S ROULETTE BOT");
    console.log("========================================");
    console.log(
        `Announce all roulette results: ` +
        `${getSettings().announceAllResults ? "ON" : "OFF"}`
    );
    console.log("========================================\n");

    await loadCurrentAuthorizations();

    setOverlayMessageHandler(
        data => handleOverlayMessage(
            data,
            sendChatMessage
        )
    );

    setOverlayStateProvider(
        getOverlayStateMessages
    );

    startOverlayServer();

    startPassiveIncome({
        getAccessToken: getCurrentBotAccessToken,
        clientId: CLIENT_ID,
        broadcasterUserId,
        botUserId
    });

    startIdleGambleReminder({
        sendChatMessage,
        isRouletteIdle: () =>
            getRouletteState().status === "idle"
    });

    startAuthMaintenance();
    connectWebSocket();

    started = true;

    return {
        started: true,
        broadcasterLogin,
        broadcasterUserId,
        botLogin,
        botUserId
    };
}


async function reconnectTwitch() {
    if (!started) {
        throw new Error(
            "RouletteBot is not running yet. Connect both Twitch accounts first."
        );
    }

    emitStatus("connecting", {
        message: "Reconnecting to Twitch..."
    });

    await loadCurrentAuthorizations();
    websocketSessionId = null;

    connectWebSocket();

    console.log(
        "[Debug] Manual Twitch reconnect requested."
    );

    return getBotStatus();
}


function getBotStatus() {
    return {
        started,
        broadcasterLogin,
        broadcasterUserId,
        botLogin,
        botUserId,
        websocketConnected:
            currentWebSocket?.readyState === WebSocket.OPEN
    };
}


module.exports = {
    startBot,
    getBotStatus,
    sendChatMessage,
    reconnectTwitch
};


// Preserve a development CLI entry point.
if (require.main === module) {
    startBot({
        authStorageDir: process.cwd(),
        onStatus: status => {
            console.log("[Status]", status);
        }
    }).catch(error => {
        console.error("\nERROR:", error.message);
        process.exit(1);
    });
}
