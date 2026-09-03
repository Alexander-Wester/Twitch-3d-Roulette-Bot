const http = require("http");
const fs = require("fs");
const path = require("path");

const {
    WebSocketServer
} = require("ws");


const PORT = 3000;


// ----------------------------------------------------
// Location of overlay.html
// ----------------------------------------------------

const overlayPath = path.join(
    __dirname,
    "..",
    "public",
    "overlay.html"
);


// ----------------------------------------------------
// Create HTTP server
// ----------------------------------------------------

const server = http.createServer(
    (request, response) => {

        // ---------------------------------------------
        // roulette.js
        // ---------------------------------------------

        if (request.url === "/roulette.js") {

            const roulettePath =
                path.join(
                    __dirname,
                    "..",
                    "public",
                    "roulette.js"
                );


            fs.readFile(
                roulettePath,
                (error, data) => {

                    if (error) {

                        response.writeHead(500);

                        response.end(
                            "Could not load roulette.js"
                        );

                        return;
                    }


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/javascript",
                            "Cache-Control":
                                "no-store, no-cache, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0"
                        }
                    );

                    response.end(data);

                }
            );

            return;
        }


        // ---------------------------------------------
        // Local Three.js library
        // ---------------------------------------------

        if (
            request.url ===
            "/vendor/three.module.js"
        ) {

            const threePath =
                path.join(
                    __dirname,
                    "..",
                    "node_modules",
                    "three",
                    "build",
                    "three.module.js"
                );


            fs.readFile(
                threePath,
                (error, data) => {

                    if (error) {

                        response.writeHead(500);

                        response.end(
                            "Could not load Three.js"
                        );

                        return;
                    }


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/javascript",
                            "Cache-Control":
                                "no-store, no-cache, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0"
                        }
                    );

                    response.end(data);

                }
            );

            return;
        }

        // ---------------------------------------------
        // Three.js core dependency
        // ---------------------------------------------

        if (
            request.url ===
            "/vendor/three.core.js"
        ) {

            const threeCorePath =
                path.join(
                    __dirname,
                    "..",
                    "node_modules",
                    "three",
                    "build",
                    "three.core.js"
                );

            fs.readFile(
                threeCorePath,
                (error, data) => {

                    if (error) {

                        response.writeHead(500);

                        response.end(
                            "Could not load Three.js core"
                        );

                        return;
                    }


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/javascript",
                            "Cache-Control":
                                "no-store, no-cache, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0"
                        }
                    );

                    response.end(data);
                }
            );

            return;
        }

        // ---------------------------------------------
        // Rapier physics engine
        // ---------------------------------------------

        if (
            request.url ===
            "/vendor/rapier.mjs"
        ) {

            const rapierPath =
                path.join(
                    __dirname,
                    "..",
                    "node_modules",
                    "@dimforge",
                    "rapier3d-compat",
                    "dist",
                    "rapier.mjs"
                );


            fs.readFile(
                rapierPath,
                (error, data) => {

                    if (error) {

                        response.writeHead(500);

                        response.end(
                            "Could not load Rapier"
                        );

                        return;
                    }


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/javascript",
                            "Cache-Control":
                                "no-store, no-cache, must-revalidate",
                            "Pragma": "no-cache",
                            "Expires": "0"
                        }
                    );

                    response.end(data);
                }
            );

            return;
        }

        if (
            request.url === "/overlay" ||
            request.url === "/overlay/"
        ) {

            fs.readFile(
                overlayPath,
                (error, data) => {

                    if (error) {

                        response.writeHead(
                            500,
                            {
                                "Content-Type":
                                    "text/plain"
                            }
                        );

                        response.end(
                            "Could not load overlay."
                        );

                        return;
                    }


                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/html"
                        }
                    );

                    response.end(data);
                }
            );

            return;
        }


        // Simple home page so we know
        // the server itself is alive.

        if (request.url === "/") {

            response.writeHead(
                200,
                {
                    "Content-Type":
                        "text/plain"
                }
            );

            response.end(
                "Rhino's Roulette server is running."
            );

            return;
        }


        response.writeHead(404);

        response.end(
            "Not found."
        );
    }
);


// ----------------------------------------------------
// WebSocket server
//
// Later this will send things like:
//
// roundStarted
// betPlaced
// bettingClosed
// rouletteResult
//
// to OBS.
// ----------------------------------------------------

const wss = new WebSocketServer({
    server
});

let overlayMessageHandler = null;
let overlayStateProvider = null;
let serverStarted = false;
const readyClients = new Set();


function setOverlayMessageHandler(handler) {
    overlayMessageHandler = handler;
}


function setOverlayStateProvider(provider) {
    overlayStateProvider = provider;
}


wss.on(
    "connection",
    socket => {

        console.log(
            "Overlay connected."
        );


        socket.send(
            JSON.stringify({
                type: "connected"
            })
        );


        // Replaying the current round state makes an OBS/browser
        // reconnect recover instead of silently missing a countdown
        // close or ball-launch message.
        if (overlayStateProvider) {
            try {
                const replayMessages =
                    overlayStateProvider() || [];

                for (const replayMessage of replayMessages) {
                    socket.send(
                        JSON.stringify(
                            replayMessage
                        )
                    );
                }
            } catch (error) {
                console.error(
                    "Could not replay overlay state:",
                    error
                );
            }
        }


        // The browser source sends the final PHYSICAL pocket
        // result back through this same WebSocket. The Twitch bot
        // registers the authoritative handler at startup.
        socket.on(
            "message",
            async rawData => {
                try {
                    const data = JSON.parse(
                        rawData.toString()
                    );

                    if (data?.type === "overlayReady") {
                        const wasReady =
                            readyClients.has(socket);

                        readyClients.add(socket);

                        if (!wasReady) {
                            console.log(
                                "Overlay physics ready."
                            );
                        }

                        return;
                    }

                    if (overlayMessageHandler) {
                        await overlayMessageHandler(
                            data,
                            socket
                        );
                    }
                } catch (error) {
                    console.error(
                        "Overlay message error:",
                        error
                    );
                }
            }
        );


        socket.on(
            "close",
            () => {
                readyClients.delete(socket);

                console.log(
                    "Overlay disconnected."
                );
            }
        );
    }
);


// ----------------------------------------------------
// Start server
// ----------------------------------------------------

function startOverlayServer() {
    if (serverStarted) {
        return;
    }

    serverStarted = true;

    server.listen(
        PORT,
        () => {
            console.log(
                `Overlay server running: http://localhost:${PORT}/overlay`
            );
        }
    );

    server.once(
        "error",
        error => {
            serverStarted = false;
            console.error(
                "Overlay server error:",
                error.message
            );
        }
    );
}


function getOverlayStatus() {
    return {
        serverStarted,
        port: PORT,
        clientCount: wss.clients.size,
        readyClientCount: readyClients.size
    };
}


// ----------------------------------------------------
// We'll use this later to send information
// to every open OBS/Streamlabs overlay.
// ----------------------------------------------------

function broadcastOverlayMessage(data) {

    const message =
        JSON.stringify(data);


    for (const client of wss.clients) {

        if (client.readyState === 1) {

            client.send(
                message
            );

        }

    }
}


module.exports = {
    startOverlayServer,
    broadcastOverlayMessage,
    setOverlayMessageHandler,
    setOverlayStateProvider,
    getOverlayStatus
};