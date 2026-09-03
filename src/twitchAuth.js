const fs = require("fs");
const path = require("path");

const {
    TWITCH_CLIENT_ID: CLIENT_ID,
    hasTwitchClientId
} = require("./appConfig");

const ACCOUNT_SCOPES = {
    broadcaster: [
        "channel:bot"
    ],

    bot: [
        "user:read:chat",
        "user:write:chat",
        "user:bot",
        "moderator:read:chatters"
    ]
};

// Twitch access tokens from Device Code Flow are currently about 4 hours.
// We validate hourly, and refresh early when less than 90 minutes remain.
// Public-client refresh tokens expire only after 30 days of INACTIVITY.
const REFRESH_EARLY_SECONDS = 90 * 60;

let authStorageDir = process.cwd();
const refreshPromises = new Map();

function requireClientId() {
    if (!hasTwitchClientId()) {
        throw new Error(
            "Twitch Client ID is not configured. Set TWITCH_CLIENT_ID in src/appConfig.js."
        );
    }
}

function assertAccountType(accountType) {
    if (!ACCOUNT_SCOPES[accountType]) {
        throw new Error(`Unknown Twitch account type: ${accountType}`);
    }
}

function setAuthStorageDir(directory) {
    authStorageDir = directory;
    fs.mkdirSync(authStorageDir, { recursive: true });
}

function getTokenPath(accountType) {
    assertAccountType(accountType);
    return path.join(authStorageDir, `${accountType}.tokens.json`);
}

function readTokenFile(accountType) {
    const filePath = getTokenPath(accountType);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        throw new Error(
            `Could not read saved Twitch authorization for ${accountType}: ${error.message}`
        );
    }
}

function writeTokenFile(accountType, tokenData, identity) {
    const filePath = getTokenPath(accountType);

    const stored = {
        ...tokenData,
        account_type: accountType,
        saved_at: new Date().toISOString(),
        identity: identity
            ? {
                user_id: identity.user_id,
                login: identity.login,
                scopes: identity.scopes || tokenData.scope || []
            }
            : undefined
    };

    fs.writeFileSync(
        filePath,
        JSON.stringify(stored, null, 2),
        { encoding: "utf8", mode: 0o600 }
    );

    return stored;
}

function deleteSavedAuth(accountType) {
    const filePath = getTokenPath(accountType);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

async function validateAccessToken(accessToken) {
    if (!accessToken) {
        return null;
    }

    const response = await fetch(
        "https://id.twitch.tv/oauth2/validate",
        {
            headers: {
                Authorization: `OAuth ${accessToken}`
            }
        }
    );

    if (!response.ok) {
        return null;
    }

    return response.json();
}

function hasRequiredScopes(accountType, identity, tokenData) {
    const granted = new Set(
        identity?.scopes ||
        tokenData?.scope ||
        []
    );

    return ACCOUNT_SCOPES[accountType]
        .every(scope => granted.has(scope));
}

function authRequiredError(accountType, message) {
    const error = new Error(message || `${accountType} Twitch authorization is required.`);
    error.code = "TWITCH_AUTH_REQUIRED";
    error.accountType = accountType;
    return error;
}

async function refreshSavedToken(accountType) {
    requireClientId();
    assertAccountType(accountType);

    if (refreshPromises.has(accountType)) {
        return refreshPromises.get(accountType);
    }

    const refreshPromise = (async () => {
        const current = readTokenFile(accountType);

        if (!current?.refresh_token) {
            throw authRequiredError(
                accountType,
                `No refresh token is saved for the ${accountType} account.`
            );
        }

        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: current.refresh_token
        });

        const response = await fetch(
            "https://id.twitch.tv/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        const data = await response.json();

        if (!response.ok || !data.access_token) {
            throw authRequiredError(
                accountType,
                `Twitch could not refresh the ${accountType} authorization. Please reconnect it in the app.`
            );
        }

        const identity = await validateAccessToken(data.access_token);

        if (!identity) {
            throw authRequiredError(
                accountType,
                `Twitch returned a refreshed ${accountType} token, but it could not be validated.`
            );
        }

        if (!hasRequiredScopes(accountType, identity, data)) {
            throw authRequiredError(
                accountType,
                `The saved ${accountType} authorization is missing required permissions. Please reconnect it.`
            );
        }

        // Device Code Flow public-client refresh tokens are one-time use.
        // Twitch sends a replacement refresh token; save the NEW one immediately.
        const merged = {
            ...current,
            ...data
        };

        const stored = writeTokenFile(
            accountType,
            merged,
            identity
        );

        console.log(
            `[Twitch Auth] Refreshed ${accountType} token for ${identity.login}.`
        );

        return {
            tokens: stored,
            identity,
            refreshed: true
        };
    })();

    refreshPromises.set(accountType, refreshPromise);

    try {
        return await refreshPromise;
    } finally {
        refreshPromises.delete(accountType);
    }
}

async function ensureValidAuth(accountType, options = {}) {
    requireClientId();
    assertAccountType(accountType);

    const forceRefresh = Boolean(options.forceRefresh);
    const current = readTokenFile(accountType);

    if (!current?.access_token) {
        throw authRequiredError(accountType);
    }

    if (!forceRefresh) {
        const identity = await validateAccessToken(current.access_token);

        if (identity) {
            if (!hasRequiredScopes(accountType, identity, current)) {
                throw authRequiredError(
                    accountType,
                    `The ${accountType} authorization is missing required Twitch permissions. Please reconnect it.`
                );
            }

            // Twitch requires maintained OAuth sessions to be validated regularly.
            // Refresh before the access token gets close to expiry so the bot does
            // not experience the current ~4 hour interruption.
            if (
                typeof identity.expires_in !== "number" ||
                identity.expires_in > REFRESH_EARLY_SECONDS
            ) {
                return {
                    tokens: current,
                    identity,
                    refreshed: false
                };
            }
        }
    }

    return refreshSavedToken(accountType);
}

async function startDeviceAuthorization(accountType, callbacks = {}) {
    requireClientId();
    assertAccountType(accountType);

    const scopes = ACCOUNT_SCOPES[accountType];

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        scopes: scopes.join(" ")
    });

    const response = await fetch(
        "https://id.twitch.tv/oauth2/device",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `Could not start Twitch authorization: ${JSON.stringify(data)}`
        );
    }

    callbacks.onDeviceCode?.({
        accountType,
        verificationUri: data.verification_uri,
        userCode: data.user_code,
        expiresIn: data.expires_in
    });

    return pollForToken(accountType, data, callbacks);
}

async function pollForToken(accountType, deviceData, callbacks = {}) {
    let intervalMs = (deviceData.interval || 5) * 1000;
    const expiresAt = Date.now() + deviceData.expires_in * 1000;

    while (Date.now() < expiresAt) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));

        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            scopes: ACCOUNT_SCOPES[accountType].join(" "),
            device_code: deviceData.device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        });

        const response = await fetch(
            "https://id.twitch.tv/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        const data = await response.json();

        if (response.ok && data.access_token) {
            const identity = await validateAccessToken(data.access_token);

            if (!identity) {
                throw new Error("Twitch authorization succeeded, but the token could not be validated.");
            }

            if (!hasRequiredScopes(accountType, identity, data)) {
                throw new Error(
                    `Twitch did not grant all required permissions for the ${accountType} account.`
                );
            }

            const stored = writeTokenFile(
                accountType,
                data,
                identity
            );

            callbacks.onAuthorized?.({
                accountType,
                login: identity.login,
                userId: identity.user_id
            });

            console.log(
                `[Twitch Auth] ${accountType} connected as ${identity.login}.`
            );

            return {
                tokens: stored,
                identity,
                refreshed: false
            };
        }

        if (data.message === "authorization_pending") {
            continue;
        }

        if (data.message === "slow_down") {
            intervalMs += 5000;
            continue;
        }

        if (data.message === "access_denied") {
            throw new Error("Twitch authorization was denied.");
        }

        throw new Error(
            `Twitch authorization failed: ${JSON.stringify(data)}`
        );
    }

    throw new Error("Twitch authorization code expired. Please try again.");
}

async function getAuthStatus(accountType) {
    try {
        const auth = await ensureValidAuth(accountType);

        return {
            connected: true,
            login: auth.identity.login,
            userId: auth.identity.user_id,
            expiresIn: auth.identity.expires_in,
            scopes: auth.identity.scopes || [],
            refreshed: auth.refreshed
        };
    } catch (error) {
        return {
            connected: false,
            login: null,
            userId: null,
            reason: error.message,
            code: error.code || null
        };
    }
}

async function importLegacyBotToken(legacyFilePath) {
    const destination = getTokenPath("bot");

    if (fs.existsSync(destination) || !fs.existsSync(legacyFilePath)) {
        return false;
    }

    let legacy;

    try {
        legacy = JSON.parse(fs.readFileSync(legacyFilePath, "utf8"));
    } catch {
        return false;
    }

    if (!legacy?.access_token || !legacy?.refresh_token) {
        return false;
    }

    fs.writeFileSync(
        destination,
        JSON.stringify(legacy, null, 2),
        { encoding: "utf8", mode: 0o600 }
    );

    try {
        await ensureValidAuth("bot");
        console.log("[Twitch Auth] Imported legacy tokens.json as the bot authorization.");
        return true;
    } catch {
        fs.rmSync(destination, { force: true });
        return false;
    }
}

module.exports = {
    ACCOUNT_SCOPES,
    setAuthStorageDir,
    getTokenPath,
    getAuthStatus,
    ensureValidAuth,
    refreshSavedToken,
    startDeviceAuthorization,
    deleteSavedAuth,
    importLegacyBotToken,
    validateAccessToken
};

// Keep a CLI path for development/testing.
if (require.main === module) {
    const accountType = process.argv[2] || "bot";

    setAuthStorageDir(process.cwd());

    console.log(`Starting Twitch authorization for: ${accountType}`);

    startDeviceAuthorization(accountType, {
        onDeviceCode: ({ verificationUri, userCode }) => {
            console.log("\nOpen this address in your browser:");
            console.log(verificationUri);
            console.log("\nIf Twitch asks for a code, enter:");
            console.log(userCode);
            console.log("\nWaiting for authorization...\n");
        }
    })
        .then(result => {
            console.log(`Authorized as ${result.identity.login}.`);
        })
        .catch(error => {
            console.error("\nERROR:", error.message);
            process.exit(1);
        });
}
