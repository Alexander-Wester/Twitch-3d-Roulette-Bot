const appApi = window.rouletteApp;

const els = {
    setupTab: document.getElementById("setupTab"),
    settingsTab: document.getElementById("settingsTab"),
    messagesTab: document.getElementById("messagesTab"),
    logsTab: document.getElementById("logsTab"),
    debugTab: document.getElementById("debugTab"),
    setupPage: document.getElementById("setupPage"),
    settingsPage: document.getElementById("settingsPage"),
    messagesPage: document.getElementById("messagesPage"),
    logsPage: document.getElementById("logsPage"),
    debugPage: document.getElementById("debugPage"),

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

    settingsSaveState: document.getElementById("settingsSaveState"),
    settingsError: document.getElementById("settingsError"),
    restoreDefaults: document.getElementById("restoreDefaults"),

    startingBalance: document.getElementById("startingBalance"),
    minimumBet: document.getElementById("minimumBet"),
    bettingTimeMinSeconds: document.getElementById("bettingTimeMinSeconds"),
    bettingTimeMaxSeconds: document.getElementById("bettingTimeMaxSeconds"),
    cooldownMinutes: document.getElementById("cooldownMinutes"),
    passiveIncomeEnabled: document.getElementById("passiveIncomeEnabled"),
    passiveIncomeAmount: document.getElementById("passiveIncomeAmount"),
    passiveIncomeMinutes: document.getElementById("passiveIncomeMinutes"),
    idleReminderEnabled: document.getElementById("idleReminderEnabled"),
    idleReminderMinutes: document.getElementById("idleReminderMinutes"),
    announceAllResults: document.getElementById("announceAllResults"),

    messagesSaveState: document.getElementById("messagesSaveState"),
    messagesError: document.getElementById("messagesError"),
    messageTypeTabs: document.getElementById("messageTypeTabs"),
    messageTypeGroup: document.getElementById("messageTypeGroup"),
    messageTypeTitle: document.getElementById("messageTypeTitle"),
    messageTypeDescription: document.getElementById("messageTypeDescription"),
    messageTypeEnabled: document.getElementById("messageTypeEnabled"),
    messageFallbackText: document.getElementById("messageFallbackText"),
    messagePlaceholdersWrap: document.getElementById("messagePlaceholdersWrap"),
    messagePlaceholders: document.getElementById("messagePlaceholders"),
    messageListWrap: document.getElementById("messageListWrap"),
    messageList: document.getElementById("messageList"),
    messageEmptyState: document.getElementById("messageEmptyState"),
    addMessage: document.getElementById("addMessage"),
    restoreDefaultMessages: document.getElementById("restoreDefaultMessages"),

    logViewer: document.getElementById("logViewer"),
    logEmptyState: document.getElementById("logEmptyState"),
    logSearch: document.getElementById("logSearch"),
    logAutoScroll: document.getElementById("logAutoScroll"),
    clearLogView: document.getElementById("clearLogView"),
    copyVisibleLogs: document.getElementById("copyVisibleLogs"),
    openLogsFolder: document.getElementById("openLogsFolder"),
    logFilters: Array.from(document.querySelectorAll(".log-filter")),

    refreshDebugState: document.getElementById("refreshDebugState"),
    debugTwitchStatus: document.getElementById("debugTwitchStatus"),
    debugTwitchDetail: document.getElementById("debugTwitchDetail"),
    debugRouletteStatus: document.getElementById("debugRouletteStatus"),
    debugRouletteDetail: document.getElementById("debugRouletteDetail"),
    debugOverlayStatus: document.getElementById("debugOverlayStatus"),
    debugOverlayDetail: document.getElementById("debugOverlayDetail"),
    debugBuildStatus: document.getElementById("debugBuildStatus"),
    debugBuildDetail: document.getElementById("debugBuildDetail"),
    reconnectTwitch: document.getElementById("reconnectTwitch"),
    debugChatMessage: document.getElementById("debugChatMessage"),
    sendDebugChat: document.getElementById("sendDebugChat"),
    debugShowOverlay: document.getElementById("debugShowOverlay"),
    debugHideOverlay: document.getElementById("debugHideOverlay"),
    debugSpinOverlay: document.getElementById("debugSpinOverlay"),
    cancelActiveRound: document.getElementById("cancelActiveRound"),
    copyDiagnostics: document.getElementById("copyDiagnostics"),
    openDataFolder: document.getElementById("openDataFolder"),
    debugOpenLogsFolder: document.getElementById("debugOpenLogsFolder"),
    openDevTools: document.getElementById("openDevTools"),
    restartApp: document.getElementById("restartApp"),

    toast: document.getElementById("toast")
};

const NUMBER_SETTING_KEYS = [
    "startingBalance",
    "minimumBet",
    "bettingTimeMinSeconds",
    "bettingTimeMaxSeconds",
    "cooldownMinutes",
    "passiveIncomeAmount",
    "passiveIncomeMinutes",
    "idleReminderMinutes"
];

const BOOLEAN_SETTING_KEYS = [
    "passiveIncomeEnabled",
    "idleReminderEnabled",
    "announceAllResults"
];

let currentState = null;
let currentSettings = null;
let authInProgress = null;
let toastTimer = null;
let settingsSaveInProgress = false;
let messageEditorState = null;
let currentMessageType = null;
let messageSaveTimer = null;
let messageSaveInProgress = false;
let logEntries = [];
let logFilter = "all";
let logSearchText = "";
let currentPage = "setup";


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


function showPage(pageName) {
    currentPage = pageName;

    const pages = {
        setup: els.setupPage,
        settings: els.settingsPage,
        messages: els.messagesPage,
        logs: els.logsPage,
        debug: els.debugPage
    };

    const tabs = {
        setup: els.setupTab,
        settings: els.settingsTab,
        messages: els.messagesTab,
        logs: els.logsTab,
        debug: els.debugTab
    };

    for (const [name, page] of Object.entries(pages)) {
        page.classList.toggle(
            "hidden",
            name !== pageName
        );
    }

    for (const [name, tab] of Object.entries(tabs)) {
        tab.classList.toggle(
            "active",
            name === pageName
        );
    }

    if (pageName === "messages") {
        renderMessageEditor();
    }

    if (pageName === "logs") {
        renderLogs();
    }

    if (pageName === "debug") {
        refreshDebugState();
    }
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


function setSettingsSaveState(state, text) {
    els.settingsSaveState.classList.remove(
        "saved",
        "saving",
        "error"
    );

    els.settingsSaveState.classList.add(state);

    const label =
        els.settingsSaveState.querySelector("span:last-child");

    label.textContent = text;
}


function clearSettingsValidation() {
    els.settingsError.classList.add("hidden");
    els.settingsError.textContent = "";

    for (const key of NUMBER_SETTING_KEYS) {
        els[key].classList.remove("invalid");
        els[key].removeAttribute("title");
    }
}


function renderSettings(settings) {
    currentSettings = {
        ...settings
    };

    for (const key of NUMBER_SETTING_KEYS) {
        els[key].value = settings[key];
    }

    for (const key of BOOLEAN_SETTING_KEYS) {
        els[key].checked = Boolean(settings[key]);
    }

    clearSettingsValidation();
    setSettingsSaveState("saved", "Saved");
}


function collectSettingsFromUi() {
    const settings = {};

    for (const key of NUMBER_SETTING_KEYS) {
        const raw = els[key].value.trim();
        settings[key] =
            raw === ""
                ? Number.NaN
                : Number(raw);
    }

    for (const key of BOOLEAN_SETTING_KEYS) {
        settings[key] =
            Boolean(els[key].checked);
    }

    return settings;
}


function showSettingsValidationErrors(
    validationErrors,
    fallbackMessage
) {
    clearSettingsValidation();

    const entries =
        Object.entries(validationErrors || {});

    for (const [key, message] of entries) {
        if (els[key]?.classList?.contains("setting-input")) {
            els[key].classList.add("invalid");
            els[key].title = message;
        }
    }

    const message =
        entries[0]?.[1] ||
        fallbackMessage ||
        "One or more settings are invalid.";

    els.settingsError.textContent = message;
    els.settingsError.classList.remove("hidden");

    setSettingsSaveState(
        "error",
        "Not saved"
    );
}


async function saveSettingsFromUi() {
    if (settingsSaveInProgress) {
        return;
    }

    settingsSaveInProgress = true;
    clearSettingsValidation();
    setSettingsSaveState("saving", "Saving...");

    try {
        const result =
            await appApi.updateSettings(
                collectSettingsFromUi()
            );

        if (!result.success) {
            showSettingsValidationErrors(
                result.validationErrors,
                result.error
            );
            return;
        }

        renderSettings(result.settings);
    } catch (error) {
        showSettingsValidationErrors(
            {},
            error.message
        );
    } finally {
        settingsSaveInProgress = false;
    }
}


// ----------------------------------------------------
// Custom messages
// ----------------------------------------------------

function setMessagesSaveState(state, text) {
    els.messagesSaveState.classList.remove(
        "saved",
        "saving",
        "error"
    );

    els.messagesSaveState.classList.add(state);
    els.messagesSaveState.querySelector("span:last-child").textContent = text;
}


function showMessagesError(message = "") {
    els.messagesError.textContent = message;
    els.messagesError.classList.toggle(
        "hidden",
        !message
    );
}


function messageCategoryEntries() {
    return Object.entries(
        messageEditorState?.categories || {}
    );
}


function renderMessageTypeTabs() {
    els.messageTypeTabs.replaceChildren();

    const entries = messageCategoryEntries();
    let lastGroup = null;

    for (const [key, category] of entries) {
        if (category.group !== lastGroup) {
            const groupName = category.group;
            const groupCategories = entries
                .filter(([, item]) => item.group === groupName)
                .map(([, item]) => item);

            const enabledCount = groupCategories.filter(
                item => item.enabled
            ).length;

            const allEnabled =
                enabledCount === groupCategories.length;

            const noneEnabled =
                enabledCount === 0;

            const heading = document.createElement("div");
            heading.className = "message-type-group-heading";

            const headingText = document.createElement("span");
            headingText.textContent = groupName;

            const groupControl = document.createElement("div");
            groupControl.className = "message-group-toggle";

            const groupState = document.createElement("span");
            groupState.className = "message-group-toggle-state";
            groupState.textContent = allEnabled
                ? "All custom"
                : noneEnabled
                    ? "All plain"
                    : "Mixed";

            const switchLabel = document.createElement("label");
            switchLabel.className = "switch message-group-switch";
            switchLabel.title =
                `Turn every ${groupName} custom message type on or off`;

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = allEnabled;
            checkbox.indeterminate = !allEnabled && !noneEnabled;
            checkbox.setAttribute(
                "aria-label",
                `Toggle all ${groupName} custom messages`
            );

            const slider = document.createElement("span");
            slider.className = "switch-slider";

            if (checkbox.indeterminate) {
                slider.classList.add("is-mixed");
            }

            checkbox.addEventListener(
                "change",
                async () => {
                    const enabled = Boolean(checkbox.checked);
                    checkbox.disabled = true;
                    showMessagesError("");
                    setMessagesSaveState("saving", "Saving section...");

                    try {
                        const flushed = await flushMessageSave();

                        if (!flushed) {
                            throw new Error(
                                "Could not save the currently edited message first."
                            );
                        }

                        const result = await appApi.updateMessageGroup(
                            groupName,
                            enabled
                        );

                        if (!result.success) {
                            throw new Error(
                                result.error ||
                                "Could not update the message section."
                            );
                        }

                        messageEditorState = result.state;
                        renderMessageEditor();
                        showToast(
                            `${groupName} custom messages turned ${enabled ? "on" : "off"}.`
                        );
                    } catch (error) {
                        showMessagesError(error.message);
                        setMessagesSaveState("error", "Not saved");
                        renderMessageTypeTabs();
                    }
                }
            );

            switchLabel.append(checkbox, slider);
            groupControl.append(groupState, switchLabel);
            heading.append(headingText, groupControl);
            els.messageTypeTabs.appendChild(heading);
            lastGroup = groupName;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "message-type-tab";
        button.classList.toggle(
            "active",
            key === currentMessageType
        );
        button.dataset.messageType = key;

        const label = document.createElement("span");
        label.textContent = category.label;

        const state = document.createElement("small");
        state.textContent = category.enabled ? "Custom" : "Plain";
        state.className = category.enabled ? "custom-on" : "custom-off";

        button.append(label, state);

        button.addEventListener(
            "click",
            async () => {
                if (key === currentMessageType) {
                    return;
                }

                await flushMessageSave();
                currentMessageType = key;
                renderMessageEditor();
            }
        );

        els.messageTypeTabs.appendChild(button);
    }
}

function createMessageRow(message, index, enabled) {
    const row = document.createElement("div");
    row.className = "message-edit-row";

    const number = document.createElement("span");
    number.className = "message-row-number";
    number.textContent = String(index + 1);

    const textarea = document.createElement("textarea");
    textarea.className = "message-textarea";
    textarea.value = message;
    textarea.rows = 2;
    textarea.maxLength = 450;
    textarea.disabled = !enabled;
    textarea.setAttribute(
        "aria-label",
        `Custom message ${index + 1}`
    );

    textarea.addEventListener(
        "input",
        () => scheduleMessageSave()
    );

    textarea.addEventListener(
        "blur",
        () => flushMessageSave()
    );

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "message-delete-button";
    remove.textContent = "Delete";
    remove.disabled = !enabled;

    remove.addEventListener(
        "click",
        async () => {
            row.remove();
            renumberMessageRows();
            await saveCurrentMessageCategory();
        }
    );

    row.append(number, textarea, remove);
    return row;
}


function renumberMessageRows() {
    Array.from(
        els.messageList.querySelectorAll(".message-edit-row")
    ).forEach((row, index) => {
        const number = row.querySelector(".message-row-number");
        const textarea = row.querySelector(".message-textarea");
        number.textContent = String(index + 1);
        textarea.setAttribute(
            "aria-label",
            `Custom message ${index + 1}`
        );
    });

    els.messageEmptyState.classList.toggle(
        "hidden",
        els.messageList.children.length !== 0
    );
}


function collectCurrentMessageCategory() {
    return {
        enabled: Boolean(els.messageTypeEnabled.checked),
        messages: Array.from(
            els.messageList.querySelectorAll(".message-textarea")
        )
            .map(textarea => textarea.value.trim())
            .filter(Boolean)
    };
}


function renderMessageEditor() {
    if (!messageEditorState) {
        return;
    }

    const entries = messageCategoryEntries();

    if (
        !currentMessageType ||
        !messageEditorState.categories[currentMessageType]
    ) {
        currentMessageType = entries[0]?.[0] || null;
    }

    renderMessageTypeTabs();

    const category =
        messageEditorState.categories[currentMessageType];

    if (!category) {
        return;
    }

    els.messageTypeGroup.textContent = category.group;
    els.messageTypeTitle.textContent = category.label;
    els.messageTypeDescription.textContent = category.description;
    els.messageTypeEnabled.checked = Boolean(category.enabled);
    els.messageFallbackText.textContent = category.fallback;

    els.messagePlaceholders.replaceChildren();

    for (const placeholder of category.placeholders) {
        const code = document.createElement("code");
        code.textContent = `{${placeholder}}`;
        els.messagePlaceholders.appendChild(code);
    }

    els.messagePlaceholdersWrap.classList.toggle(
        "hidden",
        category.placeholders.length === 0
    );

    els.messageList.replaceChildren();

    category.messages.forEach(
        (message, index) => {
            els.messageList.appendChild(
                createMessageRow(
                    message,
                    index,
                    category.enabled
                )
            );
        }
    );

    els.addMessage.disabled = !category.enabled;
    els.messageListWrap.classList.toggle(
        "personality-disabled",
        !category.enabled
    );

    renumberMessageRows();
    showMessagesError("");
    setMessagesSaveState("saved", "Saved");
}


function scheduleMessageSave() {
    clearTimeout(messageSaveTimer);
    setMessagesSaveState("saving", "Editing...");

    messageSaveTimer = setTimeout(
        () => saveCurrentMessageCategory(),
        650
    );
}


async function saveCurrentMessageCategory() {
    clearTimeout(messageSaveTimer);
    messageSaveTimer = null;

    if (
        !messageEditorState ||
        !currentMessageType ||
        messageSaveInProgress
    ) {
        return true;
    }

    messageSaveInProgress = true;
    showMessagesError("");
    setMessagesSaveState("saving", "Saving...");

    try {
        const result = await appApi.updateMessageCategory(
            currentMessageType,
            collectCurrentMessageCategory()
        );

        if (!result.success) {
            throw new Error(
                result.error || "Could not save custom messages."
            );
        }

        messageEditorState = result.state;
        setMessagesSaveState("saved", "Saved");
        renderMessageTypeTabs();
        return true;
    } catch (error) {
        showMessagesError(error.message);
        setMessagesSaveState("error", "Not saved");
        return false;
    } finally {
        messageSaveInProgress = false;
    }
}


async function flushMessageSave() {
    if (!messageSaveTimer) {
        return true;
    }

    return saveCurrentMessageCategory();
}


async function loadMessages() {
    const result = await appApi.getMessages();

    if (!result.success) {
        throw new Error(
            result.error || "Could not load custom messages."
        );
    }

    messageEditorState = result.state;
    renderMessageEditor();
}


// ----------------------------------------------------
// Logs
// ----------------------------------------------------

function formatLogTime(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "--:--:--";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


function getVisibleLogEntries() {
    const search = logSearchText.trim().toLowerCase();

    return logEntries.filter(entry => {
        if (
            logFilter !== "all" &&
            entry.level !== logFilter
        ) {
            return false;
        }

        if (
            search &&
            !entry.message.toLowerCase().includes(search)
        ) {
            return false;
        }

        return true;
    });
}


function renderLogs() {
    const visible = getVisibleLogEntries();

    els.logViewer.replaceChildren();

    const fragment = document.createDocumentFragment();

    for (const entry of visible) {
        const row = document.createElement("div");
        row.className = `log-line ${entry.level}`;

        const time = document.createElement("span");
        time.className = "log-time";
        time.textContent = formatLogTime(entry.timestamp);

        const level = document.createElement("span");
        level.className = "log-level";
        level.textContent = entry.level.toUpperCase();

        const message = document.createElement("span");
        message.className = "log-message";
        message.textContent = entry.message;

        row.append(time, level, message);
        fragment.appendChild(row);
    }

    els.logViewer.appendChild(fragment);
    els.logEmptyState.classList.toggle(
        "hidden",
        visible.length > 0
    );

    if (els.logAutoScroll.checked) {
        els.logViewer.scrollTop =
            els.logViewer.scrollHeight;
    }
}


function addLogEntry(entry) {
    if (!entry || !entry.message) {
        return;
    }

    if (
        entry.id !== undefined &&
        logEntries.some(existing => existing.id === entry.id)
    ) {
        return;
    }

    logEntries.push(entry);

    if (logEntries.length > 2000) {
        logEntries = logEntries.slice(-2000);
    }

    if (currentPage === "logs") {
        renderLogs();
    }
}


function visibleLogsAsText() {
    return getVisibleLogEntries()
        .map(entry =>
            `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
        )
        .join("\n");
}


// ----------------------------------------------------
// Debug
// ----------------------------------------------------

function formatSeconds(seconds) {
    if (
        seconds === null ||
        seconds === undefined ||
        !Number.isFinite(Number(seconds))
    ) {
        return "unknown";
    }

    const value = Math.max(0, Number(seconds));

    if (value < 120) {
        return `${Math.round(value)} sec`;
    }

    if (value < 7200) {
        return `${Math.round(value / 60)} min`;
    }

    return `${(value / 3600).toFixed(1)} hr`;
}


function renderDebugState(state) {
    const runtime = state.botRuntime || {};
    const roulette = state.roulette || {};
    const overlay = state.overlay || {};
    const botAuth = state.auth?.bot || {};
    const broadcasterAuth = state.auth?.broadcaster || {};

    els.debugTwitchStatus.textContent =
        runtime.websocketConnected
            ? "Connected"
            : runtime.started
                ? "Disconnected"
                : "Not started";

    els.debugTwitchDetail.textContent =
        broadcasterAuth.connected && botAuth.connected
            ? `${broadcasterAuth.login} ← ${botAuth.login} · bot token ${formatSeconds(botAuth.expiresIn)}`
            : "Both Twitch accounts must be connected.";

    els.debugRouletteStatus.textContent =
        roulette.status || "unknown";

    els.debugRouletteDetail.textContent =
        roulette.roundId !== null && roulette.roundId !== undefined
            ? `Round #${roulette.roundId} · ${roulette.betCount || 0} bets / ${roulette.userCount || 0} viewers`
            : roulette.status === "cooldown"
                ? `${Math.ceil((roulette.cooldownRemainingMs || 0) / 1000)} sec remaining`
                : "No active round";

    els.debugOverlayStatus.textContent =
        overlay.serverStarted
            ? "Server running"
            : "Server stopped";

    els.debugOverlayDetail.textContent =
        `${overlay.clientCount || 0} Browser Source client${overlay.clientCount === 1 ? "" : "s"} connected · port ${overlay.port || 3000}`;

    els.debugBuildStatus.textContent =
        `v${state.appVersion}`;

    els.debugBuildDetail.textContent =
        `${state.platform} · Electron ${state.electronVersion} · Node ${state.nodeVersion}`;
}


async function refreshDebugState() {
    try {
        const result = await appApi.getDebugState();

        if (!result.success) {
            throw new Error(result.error || "Could not load diagnostics.");
        }

        renderDebugState(result.state);
    } catch (error) {
        showToast(error.message, true);
    }
}


async function runDebugAction(action, successMessage) {
    try {
        const result = await action();

        if (!result?.success) {
            throw new Error(
                result?.error || "Debug action failed."
            );
        }

        if (successMessage) {
            showToast(successMessage);
        }

        await refreshDebugState();

        return result;
    } catch (error) {
        showToast(error.message, true);
        return null;
    }
}


// ----------------------------------------------------
// Navigation
// ----------------------------------------------------

els.setupTab.addEventListener(
    "click",
    () => showPage("setup")
);

els.settingsTab.addEventListener(
    "click",
    () => showPage("settings")
);

els.messagesTab.addEventListener(
    "click",
    () => showPage("messages")
);

els.logsTab.addEventListener(
    "click",
    () => showPage("logs")
);

els.debugTab.addEventListener(
    "click",
    () => showPage("debug")
);


// ----------------------------------------------------
// Setup events
// ----------------------------------------------------

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


// ----------------------------------------------------
// Settings events
// ----------------------------------------------------

for (const key of NUMBER_SETTING_KEYS) {
    els[key].addEventListener(
        "change",
        saveSettingsFromUi
    );

    els[key].addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                els[key].blur();
            }
        }
    );
}

for (const key of BOOLEAN_SETTING_KEYS) {
    els[key].addEventListener(
        "change",
        saveSettingsFromUi
    );
}

els.restoreDefaults.addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Restore all RouletteBot settings to their defaults?\n\n" +
            "Twitch logins and existing viewer balances will not be changed."
        );

        if (!confirmed) {
            return;
        }

        setSettingsSaveState(
            "saving",
            "Restoring..."
        );

        const result =
            await appApi.restoreDefaultSettings();

        if (!result.success) {
            showToast(
                result.error ||
                "Could not restore defaults.",
                true
            );

            setSettingsSaveState(
                "error",
                "Not saved"
            );
            return;
        }

        renderSettings(result.settings);
        showToast("Roulette settings restored to defaults.");
    }
);


// ----------------------------------------------------
// Custom-message events
// ----------------------------------------------------

els.messageTypeEnabled.addEventListener(
    "change",
    async () => {
        const enabled = Boolean(
            els.messageTypeEnabled.checked
        );

        for (const textarea of els.messageList.querySelectorAll(".message-textarea")) {
            textarea.disabled = !enabled;
        }

        for (const button of els.messageList.querySelectorAll(".message-delete-button")) {
            button.disabled = !enabled;
        }

        els.addMessage.disabled = !enabled;
        els.messageListWrap.classList.toggle(
            "personality-disabled",
            !enabled
        );

        await saveCurrentMessageCategory();
        renderMessageEditor();
    }
);

els.addMessage.addEventListener(
    "click",
    () => {
        if (!els.messageTypeEnabled.checked) {
            return;
        }

        const row = createMessageRow(
            "New custom message",
            els.messageList.children.length,
            true
        );

        els.messageList.appendChild(row);
        renumberMessageRows();

        const textarea = row.querySelector(".message-textarea");
        textarea.focus();
        textarea.select();
        scheduleMessageSave();
    }
);

els.restoreDefaultMessages.addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Reset every custom message to RouletteBot's shipped defaults?\n\n" +
            "This also turns custom messages back on for every message type."
        );

        if (!confirmed) {
            return;
        }

        clearTimeout(messageSaveTimer);
        messageSaveTimer = null;
        setMessagesSaveState("saving", "Restoring...");

        const result = await appApi.restoreDefaultMessages();

        if (!result.success) {
            showMessagesError(
                result.error || "Could not restore default messages."
            );
            setMessagesSaveState("error", "Not saved");
            return;
        }

        messageEditorState = result.state;
        renderMessageEditor();
        showToast("All custom messages restored to defaults.");
    }
);


// ----------------------------------------------------
// Log events
// ----------------------------------------------------

for (const button of els.logFilters) {
    button.addEventListener(
        "click",
        () => {
            logFilter = button.dataset.logLevel || "all";

            for (const other of els.logFilters) {
                other.classList.toggle(
                    "active",
                    other === button
                );
            }

            renderLogs();
        }
    );
}

els.logSearch.addEventListener(
    "input",
    () => {
        logSearchText = els.logSearch.value;
        renderLogs();
    }
);

els.logAutoScroll.addEventListener(
    "change",
    renderLogs
);

els.clearLogView.addEventListener(
    "click",
    () => {
        logEntries = [];
        renderLogs();
        showToast("Log view cleared. Saved log files were not deleted.");
    }
);

els.copyVisibleLogs.addEventListener(
    "click",
    async () => {
        const text = visibleLogsAsText();

        if (!text) {
            showToast("There are no visible log lines to copy.", true);
            return;
        }

        await appApi.copyText(text);
        showToast("Visible logs copied.");
    }
);

els.openLogsFolder.addEventListener(
    "click",
    async () => {
        const result = await appApi.openLogsFolder();

        if (!result.success) {
            showToast(result.error, true);
        }
    }
);


// ----------------------------------------------------
// Debug events
// ----------------------------------------------------

els.refreshDebugState.addEventListener(
    "click",
    refreshDebugState
);

els.reconnectTwitch.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.reconnectTwitch(),
        "Twitch reconnect started."
    )
);

els.sendDebugChat.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.sendDebugChat(
            els.debugChatMessage.value
        ),
        "Live chat test sent."
    )
);

els.debugShowOverlay.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.debugOverlayShow(),
        "Overlay table shown."
    )
);

els.debugHideOverlay.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.debugOverlayHide(),
        "Overlay table hidden."
    )
);

els.debugSpinOverlay.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.debugOverlaySpin(),
        "Isolated overlay test spin started."
    )
);

els.cancelActiveRound.addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Cancel the current roulette round?\n\n" +
            "No viewer balance will be charged, and RouletteBot will post a cancellation message in chat."
        );

        if (!confirmed) {
            return;
        }

        await runDebugAction(
            () => appApi.cancelActiveRound(),
            "Active round cancelled. Bets were released."
        );
    }
);

els.copyDiagnostics.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.copyDiagnostics(),
        "Diagnostics copied."
    )
);

els.openDataFolder.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.openDataFolder()
    )
);

els.debugOpenLogsFolder.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.openLogsFolder()
    )
);

els.openDevTools.addEventListener(
    "click",
    () => runDebugAction(
        () => appApi.openDevTools(),
        "Developer Tools opened."
    )
);

els.restartApp.addEventListener(
    "click",
    async () => {
        const confirmed = window.confirm(
            "Restart RouletteBot now?"
        );

        if (!confirmed) {
            return;
        }

        await appApi.restartApp();
    }
);


// ----------------------------------------------------
// Main-process events
// ----------------------------------------------------

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

appApi.onSettingsChanged(data => {
    if (data?.settings) {
        renderSettings(data.settings);
    }
});

appApi.onMessagesChanged(data => {
    if (data?.state && !messageSaveInProgress) {
        messageEditorState = data.state;

        if (currentPage === "messages") {
            renderMessageEditor();
        }
    }
});

appApi.onLogEntry(entry => {
    addLogEntry(entry);
});


setInterval(
    () => {
        if (currentPage === "debug") {
            refreshDebugState();
        }
    },
    3000
);


// ----------------------------------------------------
// Initial load
// ----------------------------------------------------

(async function initialize() {
    try {
        const [state, settingsResult, messagesResult, logsResult, debugResult] =
            await Promise.all([
                appApi.getSetupState(),
                appApi.getSettings(),
                appApi.getMessages(),
                appApi.getRecentLogs(750),
                appApi.getDebugState()
            ]);

        renderSetupState(state);

        if (!settingsResult.success) {
            throw new Error(
                settingsResult.error ||
                "Could not load settings."
            );
        }

        renderSettings(
            settingsResult.settings
        );

        if (!messagesResult.success) {
            throw new Error(
                messagesResult.error ||
                "Could not load custom messages."
            );
        }

        messageEditorState = messagesResult.state;
        renderMessageEditor();

        if (logsResult?.success) {
            const combined = [
                ...(logsResult.entries || []),
                ...logEntries
            ];

            const byId = new Map();

            for (const entry of combined) {
                byId.set(
                    entry.id ?? `${entry.timestamp}-${entry.message}`,
                    entry
                );
            }

            logEntries = Array.from(byId.values()).slice(-2000);
        }

        if (debugResult?.success) {
            renderDebugState(debugResult.state);
        }
    } catch (error) {
        showToast(
            `Could not load RouletteBot: ${error.message}`,
            true
        );
    }
})();
