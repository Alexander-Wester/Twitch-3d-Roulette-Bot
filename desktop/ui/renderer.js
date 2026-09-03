const appApi = window.rouletteApp;

const els = {
    clientIdWarning: document.getElementById("clientIdWarning"),

    broadcasterStatusPill: document.getElementById("broadcasterStatusPill"),
    broadcasterLogin: document.getElementById("broadcasterLogin"),
    broadcasterAvatar: document.getElementById("broadcasterAvatar"),
    broadcasterStatusText: document.getElementById("broadcasterStatusText"),
    connectBroadcaster: document.getElementById("connectBroadcaster"),

    botStatusPill: document.getElementById("botStatusPill"),
    botLogin: document.getElementById("botLogin"),
    botAvatar: document.getElementById("botAvatar"),
    botStatusText: document.getElementById("botStatusText"),
    connectBot: document.getElementById("connectBot"),

    authProgress: document.getElementById("authProgress"),
    authProgressTitle: document.getElementById("authProgressTitle"),
    authProgressText: document.getElementById("authProgressText"),
    deviceCode: document.getElementById("deviceCode"),

    overlayUrl: document.getElementById("overlayUrl"),
    copyOverlayUrl: document.getElementById("copyOverlayUrl"),
    modCommand: document.getElementById("modCommand"),
    copyModCommand: document.getElementById("copyModCommand"),

    rouletteStatusText: document.getElementById("rouletteStatusText"),
    runtimeBadge: document.getElementById("runtimeBadge"),
    runtimeBadgeText: document.getElementById("runtimeBadgeText"),

    toast: document.getElementById("toast")
};

let currentState = null;
let authInProgress = null;
let toastTimer = null;


function showToast(message, isError = false) {
    clearTimeout(toastTimer);

    els.toast.textContent = message;
    els.toast.classList.remove("hidden", "error");

    if (isError) {
        els.toast.classList.add("error");
    }

    toastTimer = setTimeout(
        () => els.toast.classList.add("hidden"),
        3500
    );
}


function setConnectedPill(element, connected) {
    element.textContent =
        connected ? "Connected" : "Not connected";

    element.classList.toggle("connected", connected);
    element.classList.toggle("disconnected", !connected);
}


function setStatusValue(element, connected, login) {
    element.textContent = connected
        ? `Connected as ${login}`
        : "Not connected";

    element.classList.toggle("good", connected);
    element.classList.toggle("bad", !connected);
}


function initialLetter(login, fallback) {
    return login?.trim()?.charAt(0)?.toUpperCase() || fallback;
}


function renderSetupState(state) {
    currentState = state;

    els.clientIdWarning.classList.toggle(
        "hidden",
        state.clientIdConfigured
    );

    els.connectBroadcaster.disabled =
        !state.clientIdConfigured ||
        authInProgress !== null;

    els.connectBot.disabled =
        !state.clientIdConfigured ||
        authInProgress !== null;

    const broadcaster = state.broadcaster;
    const bot = state.bot;

    setConnectedPill(
        els.broadcasterStatusPill,
        broadcaster.connected
    );

    setConnectedPill(
        els.botStatusPill,
        bot.connected
    );

    els.broadcasterLogin.textContent =
        broadcaster.connected
            ? broadcaster.login
            : "No account connected";

    els.botLogin.textContent =
        bot.connected
            ? bot.login
            : "No account connected";

    els.broadcasterAvatar.textContent =
        initialLetter(broadcaster.login, "B");

    els.botAvatar.textContent =
        initialLetter(bot.login, "R");

    setStatusValue(
        els.broadcasterStatusText,
        broadcaster.connected,
        broadcaster.login
    );

    setStatusValue(
        els.botStatusText,
        bot.connected,
        bot.login
    );

    els.connectBroadcaster.textContent =
        broadcaster.connected
            ? "Reconnect Broadcaster"
            : "Connect Broadcaster";

    els.connectBot.textContent =
        bot.connected
            ? "Reconnect Bot Account"
            : "Connect Bot Account";

    els.overlayUrl.textContent = state.overlayUrl;

    if (bot.connected) {
        els.modCommand.textContent = `/mod ${bot.login}`;
        els.copyModCommand.disabled = false;
    } else {
        els.modCommand.textContent = "/mod YourBotName";
        els.copyModCommand.disabled = true;
    }

    if (!broadcaster.connected || !bot.connected) {
        setRuntimeStatus({
            status: "waiting_for_setup",
            message: "Connect both Twitch accounts to start RouletteBot."
        });
    } else if (state.botRuntime?.started) {
        setRuntimeStatus({
            status: state.botRuntime.websocketConnected
                ? "online"
                : "connecting",
            message: state.botRuntime.websocketConnected
                ? `Watching ${state.botRuntime.broadcasterLogin} as ${state.botRuntime.botLogin}.`
                : "Starting Twitch connection..."
        });
    }
}


function setRuntimeStatus(data) {
    const status = data?.status || "waiting_for_setup";
    const message = data?.message || "";

    els.runtimeBadge.classList.remove(
        "online",
        "error",
        "waiting"
    );

    let badgeText = "Waiting for setup";
    let detailText = message || "Waiting for setup";

    if (status === "online") {
        els.runtimeBadge.classList.add("online");
        badgeText = "Running";
        detailText = message || "RouletteBot is online";
    } else if (
        status === "starting" ||
        status === "connecting"
    ) {
        els.runtimeBadge.classList.add("waiting");
        badgeText = "Connecting";
        detailText = message || "Connecting to Twitch...";
    } else if (
        status === "error" ||
        status === "auth_required" ||
        status === "disconnected"
    ) {
        els.runtimeBadge.classList.add("error");
        badgeText =
            status === "auth_required"
                ? "Authorization needed"
                : "Connection issue";
        detailText = message || "RouletteBot needs attention";
    } else {
        els.runtimeBadge.classList.add("waiting");
    }

    els.runtimeBadgeText.textContent = badgeText;
    els.rouletteStatusText.textContent = detailText;

    els.rouletteStatusText.classList.toggle(
        "good",
        status === "online"
    );

    els.rouletteStatusText.classList.toggle(
        "bad",
        status === "error" || status === "auth_required"
    );
}


function setAuthBusy(accountType, busy) {
    authInProgress = busy ? accountType : null;

    els.connectBroadcaster.disabled =
        busy || !currentState?.clientIdConfigured;

    els.connectBot.disabled =
        busy || !currentState?.clientIdConfigured;

    if (!busy) {
        els.authProgress.classList.add("hidden");
    }
}


async function connectAccount(accountType) {
    setAuthBusy(accountType, true);

    const label =
        accountType === "broadcaster"
            ? "broadcaster"
            : "bot";

    els.authProgress.classList.remove("hidden");
    els.authProgressTitle.textContent =
        `Starting ${label} authorization...`;
    els.authProgressText.textContent =
        "Twitch will open in your normal web browser.";
    els.deviceCode.textContent = "--------";

    const result =
        await appApi.connectTwitch(accountType);

    setAuthBusy(accountType, false);

    if (!result.success) {
        showToast(result.error, true);
        return;
    }

    if (result.restarting) {
        showToast(
            `${accountType === "broadcaster" ? "Broadcaster" : "Bot"} connected as ${result.login}. Restarting RouletteBot...`
        );
        return;
    }

    showToast(
        `${accountType === "broadcaster" ? "Broadcaster" : "Bot"} connected as ${result.login}.`
    );

    const state = await appApi.getSetupState();
    renderSetupState(state);
}


els.connectBroadcaster.addEventListener(
    "click",
    () => connectAccount("broadcaster")
);

els.connectBot.addEventListener(
    "click",
    () => connectAccount("bot")
);

els.copyOverlayUrl.addEventListener(
    "click",
    async () => {
        await appApi.copyOverlayUrl();
        showToast("OBS overlay URL copied.");
    }
);

els.copyModCommand.addEventListener(
    "click",
    async () => {
        const result = await appApi.copyModCommand();

        if (!result.success) {
            showToast(result.error, true);
            return;
        }

        showToast(`${result.command} copied.`);
    }
);


appApi.onAuthDeviceCode(data => {
    const label =
        data.accountType === "broadcaster"
            ? "Broadcaster"
            : "Bot";

    els.authProgress.classList.remove("hidden");
    els.authProgressTitle.textContent =
        `${label} authorization opened in your browser`;
    els.authProgressText.textContent =
        data.accountType === "bot"
            ? "Confirm that Twitch is signed into the BOT account, then approve access."
            : "Confirm that Twitch is signed into the MAIN CHANNEL account, then approve access.";
    els.deviceCode.textContent = data.userCode || "--------";
});

appApi.onSetupState(state => {
    renderSetupState(state);
});

appApi.onBotStatus(status => {
    setRuntimeStatus(status);
});


(async function initialize() {
    try {
        const state = await appApi.getSetupState();
        renderSetupState(state);
    } catch (error) {
        showToast(
            `Could not load RouletteBot setup: ${error.message}`,
            true
        );
    }
})();
