const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");


// ----------------------------------------------------
// User-editable RouletteBot settings.
//
// The Electron app points this module at the user's
// AppData folder. The CLI fallback uses ./data.
// ----------------------------------------------------

const DEFAULT_SETTINGS = Object.freeze({
    startingBalance: 1000,
    minimumBet: 100,

    bettingTimeMinSeconds: 20,
    bettingTimeMaxSeconds: 22,
    cooldownMinutes: 5,

    passiveIncomeEnabled: true,
    passiveIncomeAmount: 200,
    passiveIncomeMinutes: 5,

    idleReminderEnabled: true,
    idleReminderMinutes: 20,

    announceAllResults: true
});

const NUMBER_RULES = Object.freeze({
    startingBalance: {
        min: 0,
        max: 1000000000,
        label: "Starting chips"
    },
    minimumBet: {
        min: 1,
        max: 1000000000,
        label: "Minimum bet"
    },
    bettingTimeMinSeconds: {
        min: 5,
        max: 120,
        label: "Betting timer minimum"
    },
    bettingTimeMaxSeconds: {
        min: 5,
        max: 120,
        label: "Betting timer maximum"
    },
    cooldownMinutes: {
        min: 0,
        max: 1440,
        label: "Cooldown"
    },
    passiveIncomeAmount: {
        min: 1,
        max: 1000000000,
        label: "Passive income amount"
    },
    passiveIncomeMinutes: {
        min: 1,
        max: 1440,
        label: "Passive income interval"
    },
    idleReminderMinutes: {
        min: 1,
        max: 1440,
        label: "Idle reminder interval"
    }
});

const BOOLEAN_KEYS = new Set([
    "passiveIncomeEnabled",
    "idleReminderEnabled",
    "announceAllResults"
]);

let settingsStorageDir = path.join(
    process.cwd(),
    "data"
);

let cachedSettings = null;
const events = new EventEmitter();


function cloneSettings(settings) {
    return { ...settings };
}


function getSettingsPath() {
    return path.join(
        settingsStorageDir,
        "settings.json"
    );
}


function ensureStorageDirectory() {
    fs.mkdirSync(
        settingsStorageDir,
        { recursive: true }
    );
}


function writeSettingsFile(settings) {
    ensureStorageDirectory();

    const settingsPath = getSettingsPath();
    const temporaryPath = `${settingsPath}.tmp`;

    fs.writeFileSync(
        temporaryPath,
        JSON.stringify(settings, null, 2),
        "utf8"
    );

    try {
        fs.renameSync(
            temporaryPath,
            settingsPath
        );
    } catch (error) {
        // Some Windows filesystems will not replace an existing
        // destination during rename. Fall back to an explicit
        // replace while still keeping the temporary write step.
        if (fs.existsSync(settingsPath)) {
            fs.unlinkSync(settingsPath);
        }

        fs.renameSync(
            temporaryPath,
            settingsPath
        );
    }
}


function sanitizeLoadedSettings(rawSettings) {
    const sanitized = {
        ...DEFAULT_SETTINGS
    };

    if (
        !rawSettings ||
        typeof rawSettings !== "object" ||
        Array.isArray(rawSettings)
    ) {
        return sanitized;
    }

    for (const [key, rule] of Object.entries(NUMBER_RULES)) {
        const value = rawSettings[key];

        if (
            Number.isInteger(value) &&
            value >= rule.min &&
            value <= rule.max
        ) {
            sanitized[key] = value;
        }
    }

    for (const key of BOOLEAN_KEYS) {
        if (typeof rawSettings[key] === "boolean") {
            sanitized[key] = rawSettings[key];
        }
    }

    // Never allow a malformed file to create an impossible
    // betting window. Fall back to the defaults for the pair.
    if (
        sanitized.bettingTimeMinSeconds >
        sanitized.bettingTimeMaxSeconds
    ) {
        sanitized.bettingTimeMinSeconds =
            DEFAULT_SETTINGS.bettingTimeMinSeconds;

        sanitized.bettingTimeMaxSeconds =
            DEFAULT_SETTINGS.bettingTimeMaxSeconds;
    }

    return sanitized;
}


function loadSettingsFromDisk() {
    ensureStorageDirectory();

    const settingsPath = getSettingsPath();

    if (!fs.existsSync(settingsPath)) {
        const defaults = cloneSettings(
            DEFAULT_SETTINGS
        );

        writeSettingsFile(defaults);
        return defaults;
    }

    try {
        const raw = JSON.parse(
            fs.readFileSync(
                settingsPath,
                "utf8"
            )
        );

        const sanitized =
            sanitizeLoadedSettings(raw);

        // Rewriting also adds any settings introduced by a newer
        // RouletteBot version while preserving valid existing values.
        writeSettingsFile(sanitized);

        return sanitized;
    } catch (error) {
        console.error(
            "[Settings] Could not read settings.json; restoring defaults:",
            error.message
        );

        const backupPath =
            `${settingsPath}.invalid-${Date.now()}`;

        try {
            fs.renameSync(
                settingsPath,
                backupPath
            );
        } catch {
            // If the bad file cannot be moved, the defaults below
            // will still overwrite it.
        }

        const defaults = cloneSettings(
            DEFAULT_SETTINGS
        );

        writeSettingsFile(defaults);
        return defaults;
    }
}


function getSettings() {
    if (!cachedSettings) {
        cachedSettings =
            loadSettingsFromDisk();
    }

    return cloneSettings(
        cachedSettings
    );
}


function validateSettings(candidate) {
    const errors = {};

    if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
    ) {
        return {
            valid: false,
            errors: {
                settings: "Settings must be an object."
            }
        };
    }

    for (const [key, rule] of Object.entries(NUMBER_RULES)) {
        const value = candidate[key];

        if (!Number.isInteger(value)) {
            errors[key] =
                `${rule.label} must be a whole number.`;
            continue;
        }

        if (value < rule.min || value > rule.max) {
            errors[key] =
                `${rule.label} must be between ` +
                `${rule.min.toLocaleString()} and ` +
                `${rule.max.toLocaleString()}.`;
        }
    }

    for (const key of BOOLEAN_KEYS) {
        if (typeof candidate[key] !== "boolean") {
            errors[key] = `${key} must be true or false.`;
        }
    }

    if (
        !errors.bettingTimeMinSeconds &&
        !errors.bettingTimeMaxSeconds &&
        candidate.bettingTimeMinSeconds >
            candidate.bettingTimeMaxSeconds
    ) {
        errors.bettingTimeMinSeconds =
            "Betting minimum cannot be greater than the maximum.";

        errors.bettingTimeMaxSeconds =
            "Betting maximum cannot be less than the minimum.";
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}


function changedKeysBetween(before, after) {
    return Object.keys(DEFAULT_SETTINGS)
        .filter(key => before[key] !== after[key]);
}


function saveSettings(nextSettings) {
    const current = getSettings();

    const candidate = {
        ...current,
        ...nextSettings
    };

    // Ignore unknown keys rather than persisting arbitrary data.
    const normalized = {};

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        normalized[key] = candidate[key];
    }

    const validation =
        validateSettings(normalized);

    if (!validation.valid) {
        const error = new Error(
            Object.values(validation.errors)[0] ||
            "Invalid RouletteBot settings."
        );

        error.validationErrors =
            validation.errors;

        throw error;
    }

    const changedKeys =
        changedKeysBetween(
            current,
            normalized
        );

    cachedSettings = cloneSettings(
        normalized
    );

    writeSettingsFile(
        cachedSettings
    );

    if (changedKeys.length > 0) {
        events.emit(
            "changed",
            cloneSettings(cachedSettings),
            changedKeys
        );
    }

    return cloneSettings(
        cachedSettings
    );
}


function restoreDefaultSettings() {
    return saveSettings(
        cloneSettings(DEFAULT_SETTINGS)
    );
}


function setSettingsStorageDir(directory) {
    if (!directory) {
        throw new Error(
            "Settings storage directory is required."
        );
    }

    settingsStorageDir = directory;
    cachedSettings = null;

    // Ensure a valid settings file exists immediately so the
    // setup UI and bot always see the same configuration.
    return getSettings();
}


function onSettingsChanged(listener) {
    events.on(
        "changed",
        listener
    );

    return () => {
        events.off(
            "changed",
            listener
        );
    };
}


module.exports = {
    DEFAULT_SETTINGS,
    getSettings,
    saveSettings,
    restoreDefaultSettings,
    setSettingsStorageDir,
    getSettingsPath,
    validateSettings,
    onSettingsChanged
};
