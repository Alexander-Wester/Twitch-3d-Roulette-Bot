const fs = require("fs");
const path = require("path");
const util = require("util");
const { EventEmitter } = require("events");

const MAX_RECENT_ENTRIES = 2000;

let logDirectory = path.join(
    process.cwd(),
    "data",
    "logs"
);

let initialized = false;
let recentEntries = [];
let nextEntryId = 1;

const events = new EventEmitter();

const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
};


function ensureLogDirectory() {
    fs.mkdirSync(
        logDirectory,
        { recursive: true }
    );
}


function setLogStorageDir(baseDirectory) {
    logDirectory = path.join(
        baseDirectory,
        "logs"
    );

    ensureLogDirectory();
}


function getLogDirectory() {
    ensureLogDirectory();
    return logDirectory;
}


function getCurrentLogFilePath(date = new Date()) {
    const day = date
        .toISOString()
        .slice(0, 10);

    return path.join(
        getLogDirectory(),
        `roulettebot-${day}.log`
    );
}


function redactSecrets(text) {
    let safe = String(text);

    const replacements = [
        [/(\"?(?:access_token|refresh_token|client_secret)\"?\s*[:=]\s*\"?)([^\"\s,}]+)/gi, "$1[REDACTED]"],
        [/(Authorization\s*:\s*(?:Bearer|OAuth)\s+)([^\s,}]+)/gi, "$1[REDACTED]"],
        [/(\bBearer\s+)([A-Za-z0-9._~+\/-]+)/gi, "$1[REDACTED]"],
        [/(\bOAuth\s+)([A-Za-z0-9._~+\/-]+)/gi, "$1[REDACTED]"]
    ];

    for (const [pattern, replacement] of replacements) {
        safe = safe.replace(
            pattern,
            replacement
        );
    }

    return safe;
}


function formatArguments(args) {
    return redactSecrets(
        util.format(...args)
    );
}


function appendEntry(level, args) {
    const timestamp = new Date();
    const message = formatArguments(args);

    const entry = {
        id: nextEntryId++,
        timestamp: timestamp.toISOString(),
        level,
        message
    };

    recentEntries.push(entry);

    if (recentEntries.length > MAX_RECENT_ENTRIES) {
        recentEntries = recentEntries.slice(
            recentEntries.length - MAX_RECENT_ENTRIES
        );
    }

    try {
        const fileLine =
            `[${entry.timestamp}] [${level.toUpperCase()}] ${message}\n`;

        fs.appendFileSync(
            getCurrentLogFilePath(timestamp),
            fileLine,
            "utf8"
        );
    } catch (error) {
        originalConsole.error(
            "[Logger] Could not write log file:",
            error.message
        );
    }

    events.emit(
        "entry",
        { ...entry }
    );

    return entry;
}


function initializeLogger(options = {}) {
    if (options.storageDir) {
        setLogStorageDir(
            options.storageDir
        );
    } else {
        ensureLogDirectory();
    }

    if (initialized) {
        return;
    }

    initialized = true;

    console.log = (...args) => {
        originalConsole.log(...args);
        appendEntry("info", args);
    };

    console.info = (...args) => {
        originalConsole.info(...args);
        appendEntry("info", args);
    };

    console.warn = (...args) => {
        originalConsole.warn(...args);
        appendEntry("warn", args);
    };

    console.error = (...args) => {
        originalConsole.error(...args);
        appendEntry("error", args);
    };

    appendEntry(
        "info",
        ["[Logger] Logging started."]
    );
}


function getRecentLogs(limit = 500) {
    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit) || 500,
            MAX_RECENT_ENTRIES
        )
    );

    return recentEntries
        .slice(-safeLimit)
        .map(entry => ({ ...entry }));
}


function onLogEntry(listener) {
    events.on(
        "entry",
        listener
    );

    return () => {
        events.off(
            "entry",
            listener
        );
    };
}


module.exports = {
    initializeLogger,
    setLogStorageDir,
    getLogDirectory,
    getCurrentLogFilePath,
    getRecentLogs,
    onLogEntry,
    redactSecrets
};
