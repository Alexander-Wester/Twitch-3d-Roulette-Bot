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
        }
    }
);
