const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "rouletteApp",
    {
        getSetupState: () =>
            ipcRenderer.invoke("setup:get-state"),

        connectTwitch: accountType =>
            ipcRenderer.invoke(
                "auth:connect",
                accountType
            ),

        copyOverlayUrl: () =>
            ipcRenderer.invoke("overlay:copy-url"),

        copyModCommand: () =>
            ipcRenderer.invoke("bot:copy-mod-command"),

        getSettings: () =>
            ipcRenderer.invoke("settings:get"),

        updateSettings: settings =>
            ipcRenderer.invoke(
                "settings:update",
                settings
            ),

        restoreDefaultSettings: () =>
            ipcRenderer.invoke(
                "settings:restore-defaults"
            ),

        copyText: text =>
            ipcRenderer.invoke(
                "clipboard:copy-text",
                text
            ),

        getRecentLogs: limit =>
            ipcRenderer.invoke(
                "logs:get-recent",
                limit
            ),

        openLogsFolder: () =>
            ipcRenderer.invoke("logs:open-folder"),

        getDebugState: () =>
            ipcRenderer.invoke("debug:get-state"),

        copyDiagnostics: () =>
            ipcRenderer.invoke("debug:copy-diagnostics"),

        openDataFolder: () =>
            ipcRenderer.invoke("debug:open-data-folder"),

        openDevTools: () =>
            ipcRenderer.invoke("debug:open-devtools"),

        restartApp: () =>
            ipcRenderer.invoke("debug:restart-app"),

        reconnectTwitch: () =>
            ipcRenderer.invoke("debug:reconnect-twitch"),

        sendDebugChat: message =>
            ipcRenderer.invoke(
                "debug:send-chat-test",
                message
            ),

        debugOverlayShow: () =>
            ipcRenderer.invoke("debug:overlay-show"),

        debugOverlayHide: () =>
            ipcRenderer.invoke("debug:overlay-hide"),

        debugOverlaySpin: () =>
            ipcRenderer.invoke("debug:overlay-spin"),

        cancelActiveRound: () =>
            ipcRenderer.invoke("debug:cancel-round"),

        onSetupState: callback => {
            ipcRenderer.on(
                "setup:state",
                (_event, state) => callback(state)
            );
        },

        onAuthDeviceCode: callback => {
            ipcRenderer.on(
                "auth:device-code",
                (_event, data) => callback(data)
            );
        },

        onBotStatus: callback => {
            ipcRenderer.on(
                "bot:status",
                (_event, data) => callback(data)
            );
        },

        onSettingsChanged: callback => {
            ipcRenderer.on(
                "settings:changed",
                (_event, data) => callback(data)
            );
        },

        onLogEntry: callback => {
            ipcRenderer.on(
                "logs:entry",
                (_event, data) => callback(data)
            );
        }
    }
);
