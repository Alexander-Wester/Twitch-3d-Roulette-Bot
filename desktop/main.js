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
    getBotStatus
} = require("../src/twitchBot");

const {
    OVERLAY_URL,
    hasTwitchClientId
} = require("../src/appConfig");

let mainWindow = null;
let authDirectory = null;
let startBotPromise = null;


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
        width: 980,
        height: 760,
        minWidth: 860,
        minHeight: 650,
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
}


app.whenReady().then(async () => {
    app.setName("Rhino's Roulette Bot");

    authDirectory = path.join(
        app.getPath("userData"),
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
