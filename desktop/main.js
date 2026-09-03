const path = require("path");

const {
    app,
    BrowserWindow,
    ipcMain,
    shell,
    clipboard
} = require("electron");

const {
    setAuthStorageDir,
    getAuthStatus,
    startDeviceAuthorization,
    importLegacyBotToken
} = require("../src/twitchAuth");

const {
    startBot,
    getBotStatus,
    sendChatMessage,
    reconnectTwitch
} = require("../src/twitchBot");

const {
    OVERLAY_URL,
    hasTwitchClientId
} = require("../src/appConfig");

const {
    getSettings,
    saveSettings,
    restoreDefaultSettings,
    setSettingsStorageDir,
    onSettingsChanged
} = require("../src/settings");

const {
    broadcastOverlayMessage,
    getOverlayStatus
} = require("../src/overlayServer");

const {
    getRouletteState,
    getActiveRound,
    cancelActiveRound
} = require("../src/roundManager");

const {
    initializeLogger,
    getRecentLogs,
    getLogDirectory,
    onLogEntry
} = require("../src/logger");

let mainWindow = null;
let authDirectory = null;
let startBotPromise = null;
let nextDebugRoundId = -1;


function sendToRenderer(channel, payload) {
    if (
        mainWindow &&
        !mainWindow.isDestroyed()
    ) {
        mainWindow.webContents.send(
            channel,
            payload
        );
    }
}


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1120,
        height: 820,
        minWidth: 900,
        minHeight: 680,
        backgroundColor: "#101018",
        title: "Rhino's Roulette Bot",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(
        path.join(
            __dirname,
            "ui",
            "index.html"
        )
    );
}


async function getSetupState() {
    const [broadcaster, bot] = await Promise.all([
        getAuthStatus("broadcaster"),
        getAuthStatus("bot")
    ]);

    return {
        clientIdConfigured:
            hasTwitchClientId(),
        broadcaster,
        bot,
        botRuntime: getBotStatus(),
        overlayUrl: OVERLAY_URL
    };
}


async function pushSetupState() {
    const state = await getSetupState();

    sendToRenderer(
        "setup:state",
        state
    );

    return state;
}


async function maybeStartBot() {
    if (startBotPromise) {
        return startBotPromise;
    }

    const state = await getSetupState();

    if (
        !state.broadcaster.connected ||
        !state.bot.connected
    ) {
        sendToRenderer(
            "bot:status",
            {
                status: "waiting_for_setup",
                message: "Connect both Twitch accounts to start RouletteBot."
            }
        );

        return null;
    }

    startBotPromise = startBot({
        authStorageDir: authDirectory,
        onStatus: status => {
            sendToRenderer(
                "bot:status",
                status
            );
        }
    })
        .then(result => {
            return result;
        })
        .catch(error => {
            console.error(
                "Could not start RouletteBot:",
                error
            );

            sendToRenderer(
                "bot:status",
                {
                    status: "error",
                    message: error.message
                }
            );

            // Allow another attempt after the user fixes the problem.
            startBotPromise = null;
            throw error;
        });

    return startBotPromise;
}


async function getDebugState() {
    const activeRound = getActiveRound();
    const [broadcaster, bot] = await Promise.all([
        getAuthStatus("broadcaster"),
        getAuthStatus("bot")
    ]);

    return {
        appVersion: app.getVersion(),
        platform: `${process.platform} ${process.arch}`,
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        userDataDirectory: app.getPath("userData"),
        botRuntime: getBotStatus(),
        roulette: {
            ...getRouletteState(),
            betCount: activeRound?.bets?.length || 0,
            userCount: activeRound
                ? new Set(
                    activeRound.bets.map(bet => bet.userId)
                ).size
                : 0
        },
        overlay: getOverlayStatus(),
        auth: {
            broadcaster: {
                connected: broadcaster.connected,
                login: broadcaster.login,
                expiresIn: broadcaster.expiresIn ?? null
            },
            bot: {
                connected: bot.connected,
                login: bot.login,
                expiresIn: bot.expiresIn ?? null
            }
        },
        settings: getSettings()
    };
}


function activeRoundBlocksOverlayTest() {
    const status = getRouletteState().status;

    return [
        "betting",
        "closed",
        "spinning",
        "resolving"
    ].includes(status);
}


function startDebugOverlaySpin() {
    const overlayStatus =
        getOverlayStatus();

    if (overlayStatus.clientCount < 1) {
        throw new Error(
            "No OBS overlay is connected. Add or activate the Browser Source first."
        );
    }

    if (overlayStatus.readyClientCount < 1) {
        throw new Error(
            "The OBS overlay is connected but the roulette physics is still loading. Wait a moment and try again."
        );
    }

    if (activeRoundBlocksOverlayTest()) {
        throw new Error(
            "A real roulette round is active. Wait for it to finish or cancel it first."
        );
    }

    const roundId = nextDebugRoundId--;
    const bettingDurationMs = 2500;
    const bettingEndsAt = Date.now() + bettingDurationMs;

    broadcastOverlayMessage({
        type: "roundStarted",
        roundId,
        bettingDurationMs,
        bettingEndsAt,
        debug: true
    });

    setTimeout(
        () => broadcastOverlayMessage({
            type: "bettingClosed",
            roundId,
            debug: true
        }),
        bettingDurationMs
    ).unref?.();

    setTimeout(
        () => broadcastOverlayMessage({
            type: "launchBall",
            roundId,
            debug: true
        }),
        bettingDurationMs + 500
    ).unref?.();

    // A debug spin does not pass through roundManager's normal
    // result-display timer, so clean it up after enough time for
    // the physical wheel to settle and show its result.
    setTimeout(
        () => broadcastOverlayMessage({
            type: "hideTable",
            roundId,
            debug: true
        }),
        32000
    ).unref?.();

    console.log(
        `[Debug] Started isolated overlay test spin ${roundId}.`
    );

    return roundId;
}


function registerIpcHandlers() {
    ipcMain.handle(
        "setup:get-state",
        async () => getSetupState()
    );

    ipcMain.handle(
        "auth:connect",
        async (event, accountType) => {
            try {
                const wasRunning = getBotStatus().started;

                const result =
                    await startDeviceAuthorization(
                        accountType,
                        {
                            onDeviceCode: device => {
                                event.sender.send(
                                    "auth:device-code",
                                    device
                                );

                                // Twitch's Device Code flow keeps credentials
                                // out of the Electron renderer. Authentication
                                // happens on twitch.tv in the normal browser.
                                shell.openExternal(
                                    device.verificationUri
                                ).catch(error => {
                                    console.error(
                                        "Could not open Twitch authorization page:",
                                        error.message
                                    );
                                });
                            }
                        }
                    );

                await pushSetupState();

                // Reconnecting an account while the bot is already live may
                // change the channel or speaking account. A clean app restart
                // prevents an old EventSub socket from remaining attached to
                // the previous account. First-time setup does not restart.
                if (wasRunning) {
                    setTimeout(() => {
                        app.relaunch();
                        app.exit(0);
                    }, 900);

                    return {
                        success: true,
                        accountType,
                        login: result.identity.login,
                        userId: result.identity.user_id,
                        restarting: true
                    };
                }

                // On first setup, the bot automatically starts as soon as
                // both authorizations exist.
                await maybeStartBot();

                return {
                    success: true,
                    accountType,
                    login: result.identity.login,
                    userId: result.identity.user_id,
                    restarting: false
                };
            } catch (error) {
                return {
                    success: false,
                    accountType,
                    error: error.message
                };
            }
        }
    );

    ipcMain.handle(
        "settings:get",
        async () => ({
            success: true,
            settings: getSettings()
        })
    );

    ipcMain.handle(
        "settings:update",
        async (_event, nextSettings) => {
            try {
                return {
                    success: true,
                    settings: saveSettings(
                        nextSettings
                    )
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    validationErrors:
                        error.validationErrors || {}
                };
            }
        }
    );

    ipcMain.handle(
        "settings:restore-defaults",
        async () => {
            try {
                return {
                    success: true,
                    settings:
                        restoreDefaultSettings()
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );

    ipcMain.handle(
        "overlay:copy-url",
        async () => {
            await Promise.resolve(
                clipboard.writeText(OVERLAY_URL)
            );

            return true;
        }
    );

    ipcMain.handle(
        "bot:copy-mod-command",
        async () => {
            const status = await getAuthStatus("bot");

            if (!status.connected || !status.login) {
                return {
                    success: false,
                    error: "Connect the bot account first."
                };
            }

            const command = `/mod ${status.login}`;

            await Promise.resolve(
                clipboard.writeText(command)
            );

            return {
                success: true,
                command
            };
        }
    );


    ipcMain.handle(
        "clipboard:copy-text",
        async (_event, text) => {
            clipboard.writeText(
                String(text || "")
            );

            return { success: true };
        }
    );

    ipcMain.handle(
        "logs:get-recent",
        async (_event, limit = 750) => ({
            success: true,
            entries: getRecentLogs(limit)
        })
    );

    ipcMain.handle(
        "logs:open-folder",
        async () => {
            const error = await shell.openPath(
                getLogDirectory()
            );

            return error
                ? { success: false, error }
                : { success: true };
        }
    );

    ipcMain.handle(
        "debug:get-state",
        async () => ({
            success: true,
            state: await getDebugState()
        })
    );

    ipcMain.handle(
        "debug:copy-diagnostics",
        async () => {
            const diagnostics = await getDebugState();

            clipboard.writeText(
                JSON.stringify(
                    diagnostics,
                    null,
                    2
                )
            );

            console.log(
                "[Debug] Diagnostics copied to clipboard."
            );

            return { success: true };
        }
    );

    ipcMain.handle(
        "debug:open-data-folder",
        async () => {
            const error = await shell.openPath(
                app.getPath("userData")
            );

            return error
                ? { success: false, error }
                : { success: true };
        }
    );

    ipcMain.handle(
        "debug:open-devtools",
        async () => {
            mainWindow?.webContents.openDevTools({
                mode: "detach"
            });

            console.log(
                "[Debug] Developer Tools opened."
            );

            return { success: true };
        }
    );

    ipcMain.handle(
        "debug:restart-app",
        async () => {
            console.warn(
                "[Debug] Application restart requested."
            );

            setTimeout(() => {
                app.relaunch();
                app.exit(0);
            }, 250);

            return { success: true };
        }
    );

    ipcMain.handle(
        "debug:reconnect-twitch",
        async () => {
            try {
                const status = await reconnectTwitch();

                return {
                    success: true,
                    status
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );

    ipcMain.handle(
        "debug:send-chat-test",
        async (_event, rawMessage) => {
            try {
                if (!getBotStatus().started) {
                    throw new Error(
                        "RouletteBot is not connected to Twitch yet."
                    );
                }

                const message = String(
                    rawMessage ||
                    "🎰 RouletteBot debug test: chat connection is working."
                ).trim();

                if (!message) {
                    throw new Error(
                        "Enter a chat test message first."
                    );
                }

                if (message.length > 450) {
                    throw new Error(
                        "Debug chat message is too long."
                    );
                }

                await sendChatMessage(message);

                console.log(
                    `[Debug] Live chat test sent: ${message}`
                );

                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );

    ipcMain.handle(
        "debug:overlay-show",
        async () => {
            const overlayStatus =
                getOverlayStatus();

            if (overlayStatus.clientCount < 1) {
                return {
                    success: false,
                    error: "No OBS overlay is connected. Add or activate the Browser Source first."
                };
            }

            if (overlayStatus.readyClientCount < 1) {
                return {
                    success: false,
                    error: "The OBS overlay is connected but the roulette physics is still loading. Wait a moment and try again."
                };
            }

            if (activeRoundBlocksOverlayTest()) {
                return {
                    success: false,
                    error: "A real roulette round is active."
                };
            }

            const roundId = nextDebugRoundId--;

            broadcastOverlayMessage({
                type: "debugShowTable",
                roundId,
                debug: true
            });

            console.log(
                "[Debug] Overlay table shown."
            );

            return { success: true };
        }
    );

    ipcMain.handle(
        "debug:overlay-hide",
        async () => {
            const overlayStatus =
                getOverlayStatus();

            if (overlayStatus.clientCount < 1) {
                return {
                    success: false,
                    error: "No OBS overlay is connected. Add or activate the Browser Source first."
                };
            }

            if (overlayStatus.readyClientCount < 1) {
                return {
                    success: false,
                    error: "The OBS overlay is connected but the roulette physics is still loading. Wait a moment and try again."
                };
            }

            if (activeRoundBlocksOverlayTest()) {
                return {
                    success: false,
                    error: "A real roulette round is active. Use Cancel Active Round if you need to stop it."
                };
            }

            broadcastOverlayMessage({
                type: "debugHideTable",
                debug: true
            });

            console.log(
                "[Debug] Overlay table hidden."
            );

            return { success: true };
        }
    );

    ipcMain.handle(
        "debug:overlay-spin",
        async () => {
            try {
                return {
                    success: true,
                    roundId: startDebugOverlaySpin()
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );

    ipcMain.handle(
        "debug:cancel-round",
        async () => {
            try {
                const result = cancelActiveRound();

                if (!result.success) {
                    return {
                        success: false,
                        error: "There is no active roulette round to cancel."
                    };
                }

                if (getBotStatus().started) {
                    await sendChatMessage(
                        "⚠ Roulette round cancelled by the streamer. No bets were charged."
                    );
                }

                return {
                    success: true,
                    result
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    );
}


app.whenReady().then(async () => {
    app.setName("Rhino's Roulette Bot");

    const userDataDirectory =
        app.getPath("userData");

    initializeLogger({
        storageDir: userDataDirectory
    });

    onLogEntry(entry => {
        sendToRenderer(
            "logs:entry",
            entry
        );
    });

    console.log(
        `[App] Rhino's Roulette Bot v${app.getVersion()} starting.`
    );

    setSettingsStorageDir(
        userDataDirectory
    );

    authDirectory = path.join(
        userDataDirectory,
        "auth"
    );

    setAuthStorageDir(authDirectory);

    // One-time convenience for the current development install:
    // if the old project-root tokens.json exists, import it as the
    // BOT authorization. This never ships anybody else's token.
    await importLegacyBotToken(
        path.join(
            __dirname,
            "..",
            "tokens.json"
        )
    );

    registerIpcHandlers();

    onSettingsChanged(
        (settings, changedKeys) => {
            sendToRenderer(
                "settings:changed",
                {
                    settings,
                    changedKeys
                }
            );
        }
    );

    createWindow();

    mainWindow.webContents.once(
        "did-finish-load",
        async () => {
            await pushSetupState();

            try {
                await maybeStartBot();
            } catch {
                // Error was already sent to the UI.
            }
        }
    );

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
