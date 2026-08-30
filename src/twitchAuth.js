require("dotenv").config();
const fs = require("fs");

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;

const SCOPES = [
    "user:read:chat",
    "user:write:chat",
    "user:bot"
];

async function startDeviceAuthorization() {
    if (!CLIENT_ID) {
        throw new Error("TWITCH_CLIENT_ID is missing from .env");
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        scopes: SCOPES.join(" ")
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

    console.log("\n========================================");
    console.log("TWITCH AUTHORIZATION");
    console.log("========================================");
    console.log("\nOpen this address in your browser:");
    console.log(data.verification_uri);

    console.log("\nIf Twitch asks for a code, enter:");
    console.log(data.user_code);

    console.log("\nIMPORTANT:");
    console.log("Log into the TWITCH BOT ACCOUNT when authorizing.");
    console.log("\nWaiting for authorization...\n");

    return pollForToken(data);
}

async function pollForToken(deviceData) {
    const intervalMs = (deviceData.interval || 5) * 1000;
    const expiresAt = Date.now() + deviceData.expires_in * 1000;

    while (Date.now() < expiresAt) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));

        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            scopes: SCOPES.join(" "),
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
            fs.writeFileSync(
                "tokens.json",
                JSON.stringify(data, null, 2)
            );

            console.log("Twitch authorization successful!");
            console.log("Token saved to tokens.json.");
            console.log("\nDO NOT upload tokens.json to GitHub.");

            return data;
        }

        if (data.message === "authorization_pending") {
            process.stdout.write(".");
            continue;
        }

        throw new Error(
            `Twitch authorization failed: ${JSON.stringify(data)}`
        );
    }

    throw new Error("Twitch authorization code expired.");
}

startDeviceAuthorization()
    .catch(error => {
        console.error("\nERROR:", error.message);
        process.exit(1);
    });