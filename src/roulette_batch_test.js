const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

(async () => {
    const rapierModule =
        await import(
            "@dimforge/rapier3d-compat"
        );

    const RAPIER =
        rapierModule.default ??
        rapierModule;

    await RAPIER.init();

// ============================================================
// NODE ROULETTE BATCH TEST
// ============================================================
//
// Run:
//
//   node src/roulette_batch_test.js 1000
//
// or:
//
//   node src/roulette_batch_test.js 10000
//
// This is diagnostic-only and does not need to ship with the app.
// ============================================================


// ============================================================
// CURRENT ROULETTE PHYSICS
// ============================================================

const FIXED_TIME_STEP = 1 / 240;

const BALL_RADIUS = 0.14;

const BALL_START_SPEED_MIN = 11.5;
const BALL_START_SPEED_MAX = 12.5;

const BOWL_INNER_RADIUS = 2.70;
const BOWL_OUTER_RADIUS = 5.00;
const BOWL_BASE_Y = -0.02;

const BALL_START_CONTACT_RADIUS = 4.835;

const INNER_BASE_SLOPE = 0.45;
const OUTER_RISE = 1.63;
const OUTER_POWER = 5.0;

const ROLLING_DRAG = 0.14;

const BALL_FRICTION = 0.55;
const BOWL_FRICTION = 0.55;

const ZERO_BOUNCE = 0.0;

const BOWL_RADIAL_SAMPLES = 180;
const BOWL_ANGULAR_SEGMENTS = 512;


// ============================================================
// ROULETTE LAYOUT
// ============================================================

const rouletteNumbers = [
    0,
    32,
    15,
    19,
    4,
    21,
    2,
    25,
    17,
    34,
    6,
    27,
    13,
    36,
    11,
    30,
    8,
    23,
    10,
    5,
    24,
    16,
    33,
    1,
    20,
    14,
    31,
    9,
    22,
    18,
    29,
    7,
    28,
    12,
    35,
    3,
    26
];

const redNumbers = new Set([
    1, 3, 5, 7, 9,
    12, 14, 16, 18,
    19, 21, 23, 25, 27,
    30, 32, 34, 36
]);

const POCKET_COUNT =
    rouletteNumbers.length;

const POCKET_ANGLE =
    Math.PI * 2 /
    POCKET_COUNT;

const ROTOR_OUTER_RADIUS = 2.70;
const ROTOR_INNER_RADIUS = 1.58;

const ROTOR_FLOOR_TOP_Y = BOWL_BASE_Y;
const ROTOR_FLOOR_HALF_HEIGHT = 0.08;

const DIVIDER_HEIGHT = 0.040;
const DIVIDER_THICKNESS = 0.018;

const DIVIDER_INNER_RADIUS =
    ROTOR_INNER_RADIUS + 0.03;

const DIVIDER_OUTER_RADIUS =
    ROTOR_OUTER_RADIUS - 0.03;

const DIVIDER_LENGTH =
    DIVIDER_OUTER_RADIUS -
    DIVIDER_INNER_RADIUS;

const DIVIDER_MIDDLE_RADIUS =
    (
        DIVIDER_INNER_RADIUS +
        DIVIDER_OUTER_RADIUS
    ) / 2;

const CENTER_HUB_RADIUS =
    ROTOR_INNER_RADIUS -
    0.025;

const CENTER_HUB_HALF_HEIGHT =
    0.18;

const CENTER_HUB_CENTER_Y =
    ROTOR_FLOOR_TOP_Y +
    CENTER_HUB_HALF_HEIGHT;


// ============================================================
// TEST SETTINGS
// ============================================================

const SETTLED_SPEED_THRESHOLD = 0.22;

const MAX_SIM_SECONDS = 30;

const MAX_STEPS =
    Math.ceil(
        MAX_SIM_SECONDS /
        FIXED_TIME_STEP
    );


// ============================================================
// HELPERS
// ============================================================

function clamp01(value) {
    return Math.min(
        Math.max(value, 0),
        1
    );
}

function getBowlHeight(radius) {
    const distance =
        Math.max(
            radius -
            BOWL_INNER_RADIUS,
            0
        );

    const span =
        BOWL_OUTER_RADIUS -
        BOWL_INNER_RADIUS;

    const u =
        clamp01(
            distance / span
        );

    return (
        BOWL_BASE_Y +
        INNER_BASE_SLOPE *
            distance +
        OUTER_RISE *
            Math.pow(
                u,
                OUTER_POWER
            )
    );
}

function getBowlSlope(radius) {
    const distance =
        Math.max(
            radius -
            BOWL_INNER_RADIUS,
            0
        );

    const span =
        BOWL_OUTER_RADIUS -
        BOWL_INNER_RADIUS;

    const u =
        clamp01(
            distance / span
        );

    return (
        INNER_BASE_SLOPE +
        (
            OUTER_RISE *
            OUTER_POWER /
            span
        ) *
        Math.pow(
            u,
            OUTER_POWER - 1
        )
    );
}

function getBallCenterAtContact(
    contactRadius,
    angle
) {
    const surfaceY =
        getBowlHeight(
            contactRadius
        );

    const slope =
        getBowlSlope(
            contactRadius
        );

    const normalLength =
        Math.sqrt(
            1 +
            slope * slope
        );

    const inwardNormalAmount =
        slope /
        normalLength;

    const upNormalAmount =
        1 /
        normalLength;

    const centerRadius =
        contactRadius -
        BALL_RADIUS *
            inwardNormalAmount;

    return {
        x:
            Math.cos(angle) *
            centerRadius,

        y:
            surfaceY +
            BALL_RADIUS *
                upNormalAmount,

        z:
            Math.sin(angle) *
            centerRadius,

        normal: {
            x:
                -Math.cos(angle) *
                inwardNormalAmount,

            y:
                upNormalAmount,

            z:
                -Math.sin(angle) *
                inwardNormalAmount
        }
    };
}

function cross(a, b) {
    return {
        x:
            a.y * b.z -
            a.z * b.y,

        y:
            a.z * b.x -
            a.x * b.z,

        z:
            a.x * b.y -
            a.y * b.x
    };
}

function vectorLength(v) {
    return Math.sqrt(
        v.x * v.x +
        v.y * v.y +
        v.z * v.z
    );
}

function normalizeAngle(angle) {
    let value =
        angle %
        (
            Math.PI * 2
        );

    if (value < 0) {
        value +=
            Math.PI * 2;
    }

    return value;
}

function getPocketIndexFromAngle(angle) {
    return (
        Math.floor(
            normalizeAngle(angle) /
            POCKET_ANGLE
        ) %
        POCKET_COUNT
    );
}

function getPocketIndexFromPosition(position) {
    return getPocketIndexFromAngle(
        Math.atan2(
            position.z,
            position.x
        )
    );
}

function getColor(number) {
    if (number === 0) {
        return "green";
    }

    if (redNumbers.has(number)) {
        return "red";
    }

    return "black";
}


// ============================================================
// CREATE STATIC WORLD ONCE
// ============================================================

function createWorld() {
    const world =
        new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0
        });

    world.timestep =
        FIXED_TIME_STEP;


    // ---------------- BOWL ----------------

    const profile = [];

    for (
        let i = 0;
        i < BOWL_RADIAL_SAMPLES;
        i++
    ) {
        const t =
            i /
            (
                BOWL_RADIAL_SAMPLES - 1
            );

        const radius =
            BOWL_INNER_RADIUS +
            (
                BOWL_OUTER_RADIUS -
                BOWL_INNER_RADIUS
            ) *
            t;

        profile.push({
            radius,
            height:
                getBowlHeight(radius)
        });
    }

    const vertices = [];
    const indices = [];

    for (
        let ringIndex = 0;
        ringIndex < profile.length;
        ringIndex++
    ) {
        const ring =
            profile[ringIndex];

        for (
            let segment = 0;
            segment <
                BOWL_ANGULAR_SEGMENTS;
            segment++
        ) {
            const angle =
                (
                    segment /
                    BOWL_ANGULAR_SEGMENTS
                ) *
                Math.PI *
                2;

            vertices.push(
                Math.cos(angle) *
                    ring.radius,

                ring.height,

                Math.sin(angle) *
                    ring.radius
            );
        }
    }

    for (
        let ringIndex = 0;
        ringIndex <
            profile.length - 1;
        ringIndex++
    ) {
        for (
            let segment = 0;
            segment <
                BOWL_ANGULAR_SEGMENTS;
            segment++
        ) {
            const nextSegment =
                (
                    segment + 1
                ) %
                BOWL_ANGULAR_SEGMENTS;

            const a =
                ringIndex *
                    BOWL_ANGULAR_SEGMENTS +
                segment;

            const b =
                ringIndex *
                    BOWL_ANGULAR_SEGMENTS +
                nextSegment;

            const c =
                (
                    ringIndex + 1
                ) *
                    BOWL_ANGULAR_SEGMENTS +
                segment;

            const d =
                (
                    ringIndex + 1
                ) *
                    BOWL_ANGULAR_SEGMENTS +
                nextSegment;

            indices.push(
                a,
                b,
                c
            );

            indices.push(
                b,
                d,
                c
            );
        }
    }

    world.createCollider(
        RAPIER.ColliderDesc
            .trimesh(
                new Float32Array(
                    vertices
                ),
                new Uint32Array(
                    indices
                ),
                RAPIER
                    .TriMeshFlags
                    .FIX_INTERNAL_EDGES
            )
            .setFriction(
                BOWL_FRICTION
            )
            .setRestitution(
                ZERO_BOUNCE
            )
    );


    // ---------------- ROTOR FLOOR ----------------

    const rotorFloorBody =
        world.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
        );

    world.createCollider(
        RAPIER.ColliderDesc
            .cylinder(
                ROTOR_FLOOR_HALF_HEIGHT,
                ROTOR_OUTER_RADIUS
            )
            .setTranslation(
                0,
                ROTOR_FLOOR_TOP_Y -
                    ROTOR_FLOOR_HALF_HEIGHT,
                0
            )
            .setFriction(
                0.52
            )
            .setRestitution(
                ZERO_BOUNCE
            ),
        rotorFloorBody
    );


    // ---------------- DIVIDERS ----------------

    for (
        let index = 0;
        index < POCKET_COUNT;
        index++
    ) {
        const angle =
            index *
            POCKET_ANGLE;

        const x =
            Math.cos(angle) *
            DIVIDER_MIDDLE_RADIUS;

        const z =
            Math.sin(angle) *
            DIVIDER_MIDDLE_RADIUS;

        const halfAngle =
            -angle / 2;

        world.createCollider(
            RAPIER.ColliderDesc
                .cuboid(
                    DIVIDER_LENGTH / 2,
                    DIVIDER_HEIGHT / 2,
                    DIVIDER_THICKNESS / 2
                )
                .setTranslation(
                    x,
                    ROTOR_FLOOR_TOP_Y +
                        DIVIDER_HEIGHT / 2,
                    z
                )
                .setRotation({
                    x: 0,
                    y:
                        Math.sin(
                            halfAngle
                        ),
                    z: 0,
                    w:
                        Math.cos(
                            halfAngle
                        )
                })
                .setFriction(
                    0.72
                )
                .setRestitution(
                    ZERO_BOUNCE
                )
        );
    }


    // ---------------- CENTER HUB ----------------

    const centerHubBody =
        world.createRigidBody(
            RAPIER.RigidBodyDesc
                .fixed()
        );

    world.createCollider(
        RAPIER.ColliderDesc
            .cylinder(
                CENTER_HUB_HALF_HEIGHT,
                CENTER_HUB_RADIUS
            )
            .setTranslation(
                0,
                CENTER_HUB_CENTER_Y,
                0
            )
            .setFriction(
                0.68
            )
            .setRestitution(
                ZERO_BOUNCE
            ),
        centerHubBody
    );

    return world;
}


// ============================================================
// SIMULATE ONE SPIN
// ============================================================

function simulateSpin(
    world,
    trial
) {
    const speed =
        BALL_START_SPEED_MIN +
        Math.random() *
        (
            BALL_START_SPEED_MAX -
            BALL_START_SPEED_MIN
        );

    const startAngle =
        Math.random() *
        Math.PI *
        2;

    const start =
        getBallCenterAtContact(
            BALL_START_CONTACT_RADIUS,
            startAngle
        );

    const ballBody =
        world.createRigidBody(
            RAPIER.RigidBodyDesc
                .dynamic()
                .setTranslation(
                    start.x,
                    start.y,
                    start.z
                )
                .setLinearDamping(
                    ROLLING_DRAG
                )
                .setAngularDamping(
                    ROLLING_DRAG
                )
        );

    world.createCollider(
        RAPIER.ColliderDesc
            .ball(
                BALL_RADIUS
            )
            .setFriction(
                BALL_FRICTION
            )
            .setRestitution(
                ZERO_BOUNCE
            ),
        ballBody
    );

    ballBody.enableCcd(true);


    const launchVelocity = {
        x:
            -Math.sin(startAngle) *
            speed,

        y: 0,

        z:
            Math.cos(startAngle) *
            speed
    };

    ballBody.setLinvel(
        launchVelocity,
        true
    );


    const spin =
        cross(
            start.normal,
            launchVelocity
        );

    ballBody.setAngvel(
        {
            x:
                spin.x /
                BALL_RADIUS,

            y:
                spin.y /
                BALL_RADIUS,

            z:
                spin.z /
                BALL_RADIUS
        },
        true
    );


    let lastAngle =
        Math.atan2(
            start.z,
            start.x
        );

    let accumulatedAngle = 0;
    let freeRevolutions = 0;
    let enteredRotor = false;

    const startPocketIndex =
        getPocketIndexFromAngle(
            startAngle
        );

    let result = null;


    for (
        let step = 1;
        step <= MAX_STEPS;
        step++
    ) {
        world.step();

        const position =
            ballBody.translation();

        const radius =
            Math.sqrt(
                position.x *
                    position.x +
                position.z *
                    position.z
            );

        const angle =
            Math.atan2(
                position.z,
                position.x
            );


        if (!enteredRotor) {
            let delta =
                angle -
                lastAngle;

            if (delta > Math.PI) {
                delta -=
                    Math.PI * 2;
            }

            if (delta < -Math.PI) {
                delta +=
                    Math.PI * 2;
            }

            accumulatedAngle +=
                Math.abs(delta);

            freeRevolutions =
                accumulatedAngle /
                (
                    Math.PI * 2
                );

            if (
                radius <
                BOWL_INNER_RADIUS -
                    BALL_RADIUS *
                        0.15
            ) {
                enteredRotor = true;
            }
        }

        lastAngle =
            angle;


        if (enteredRotor) {
            const currentSpeed =
                vectorLength(
                    ballBody.linvel()
                );

            if (
                currentSpeed <
                    SETTLED_SPEED_THRESHOLD &&
                radius >
                    ROTOR_INNER_RADIUS &&
                radius <
                    ROTOR_OUTER_RADIUS +
                    BALL_RADIUS
            ) {
                const winnerIndex =
                    getPocketIndexFromPosition(
                        position
                    );

                const winner =
                    rouletteNumbers[
                        winnerIndex
                    ];

                result = {
                    trial,
                    speed,
                    startAngleDeg:
                        startAngle *
                        180 /
                        Math.PI,
                    startPocketIndex,
                    winnerIndex,
                    winner,
                    color:
                        getColor(winner),
                    pocketOffset:
                        (
                            winnerIndex -
                            startPocketIndex +
                            POCKET_COUNT
                        ) %
                        POCKET_COUNT,
                    freeRevolutions,
                    settleSeconds:
                        step *
                        FIXED_TIME_STEP,
                    timedOut:
                        false
                };

                break;
            }
        }
    }


    if (!result) {
        result = {
            trial,
            speed,
            startAngleDeg:
                startAngle *
                180 /
                Math.PI,
            startPocketIndex,
            winnerIndex: null,
            winner: null,
            color: "timeout",
            pocketOffset: null,
            freeRevolutions,
            settleSeconds:
                MAX_SIM_SECONDS,
            timedOut:
                true
        };
    }


    world.removeRigidBody(
        ballBody
    );

    return result;
}


// ============================================================
// SIMPLE STATISTICS
// ============================================================

function shannonEntropy(counts) {
    const total =
        counts.reduce(
            (sum, value) =>
                sum + value,
            0
        );

    if (total === 0) {
        return 0;
    }

    let entropy = 0;

    for (const count of counts) {
        if (count === 0) {
            continue;
        }

        const p =
            count / total;

        entropy -=
            p *
            Math.log2(p);
    }

    return entropy;
}


function summarize(results) {
    const completed =
        results.filter(
            r => !r.timedOut
        );

    const n =
        completed.length;

    const numberCounts =
        new Array(POCKET_COUNT)
            .fill(0);

    const offsetCounts =
        new Array(POCKET_COUNT)
            .fill(0);

    let red = 0;
    let black = 0;
    let green = 0;

    let revSum = 0;
    let settleSum = 0;


    for (const result of completed) {
        numberCounts[
            result.winnerIndex
        ]++;

        offsetCounts[
            result.pocketOffset
        ]++;

        if (result.color === "red") {
            red++;
        } else if (
            result.color === "black"
        ) {
            black++;
        } else if (
            result.color === "green"
        ) {
            green++;
        }

        revSum +=
            result.freeRevolutions;

        settleSum +=
            result.settleSeconds;
    }


    const expected =
        n /
        POCKET_COUNT;

    let chiSquare = 0;

    for (const count of numberCounts) {
        if (expected > 0) {
            chiSquare +=
                Math.pow(
                    count - expected,
                    2
                ) /
                expected;
        }
    }


    const maxEntropy =
        Math.log2(
            POCKET_COUNT
        );

    const offsetEntropy =
        shannonEntropy(
            offsetCounts
        );


    return {
        completed: n,
        timeouts:
            results.length - n,

        expectedPerNumber:
            expected,

        numberCounts,
        offsetCounts,

        chiSquare,

        red,
        black,
        green,

        averageRevolutions:
            n
                ? revSum / n
                : 0,

        averageSettleSeconds:
            n
                ? settleSum / n
                : 0,

        offsetEntropy,

        maxEntropy,

        offsetEntropyPercent:
            maxEntropy
                ? (
                    offsetEntropy /
                    maxEntropy *
                    100
                )
                : 0
    };
}


// ============================================================
// CSV
// ============================================================

function makeCsv(results) {
    const rows = [
        [
            "trial",
            "launch_speed",
            "start_angle_deg",
            "start_sector_index",
            "winner_index",
            "winner",
            "color",
            "pocket_offset",
            "free_revolutions",
            "settle_seconds",
            "timed_out"
        ].join(",")
    ];

    for (const result of results) {
        rows.push([
            result.trial,
            result.speed.toFixed(6),
            result.startAngleDeg.toFixed(6),
            result.startPocketIndex,
            result.winnerIndex ?? "",
            result.winner ?? "",
            result.color,
            result.pocketOffset ?? "",
            result.freeRevolutions.toFixed(6),
            result.settleSeconds.toFixed(6),
            result.timedOut ? 1 : 0
        ].join(","));
    }

    return rows.join("\n");
}


// ============================================================
// MAIN
// ============================================================

const requestedTrials =
    Number(
        process.argv[2]
    );

const trials =
    Number.isFinite(
        requestedTrials
    ) &&
    requestedTrials > 0
        ? Math.floor(
            requestedTrials
        )
        : 1000;


console.log("");
console.log("============================================================");
console.log("ROULETTE BATCH PHYSICS TEST");
console.log("============================================================");
console.log(`Trials: ${trials.toLocaleString()}`);
console.log(
    `Launch speed range: ` +
    `${BALL_START_SPEED_MIN.toFixed(1)} - ` +
    `${BALL_START_SPEED_MAX.toFixed(1)}`
);
console.log("Random start angle: 0° - 360°");
console.log("Rendering: disabled");
console.log("");


const world =
    createWorld();

const results = [];

const started =
    performance.now();


for (
    let trial = 1;
    trial <= trials;
    trial++
) {
    results.push(
        simulateSpin(
            world,
            trial
        )
    );

    if (
        trial % 100 === 0 ||
        trial === trials
    ) {
        const elapsedSeconds =
            (
                performance.now() -
                started
            ) /
            1000;

        const rate =
            trial /
            Math.max(
                elapsedSeconds,
                0.001
            );

        process.stdout.write(
            `\r${trial.toLocaleString()} / ` +
            `${trials.toLocaleString()} ` +
            `| ${rate.toFixed(1)} spins/sec`
        );
    }
}

console.log("");
console.log("");


const elapsedSeconds =
    (
        performance.now() -
        started
    ) /
    1000;

const summary =
    summarize(
        results
    );


console.log("============================================================");
console.log("SUMMARY");
console.log("============================================================");
console.log(
    `Completed: ` +
    `${summary.completed.toLocaleString()}`
);
console.log(
    `Timeouts: ` +
    `${summary.timeouts.toLocaleString()}`
);
console.log(
    `Wall time: ` +
    `${elapsedSeconds.toFixed(2)} sec`
);
console.log(
    `Average free revolutions: ` +
    `${summary.averageRevolutions.toFixed(3)}`
);
console.log(
    `Average simulated settle time: ` +
    `${summary.averageSettleSeconds.toFixed(3)} sec`
);
console.log(
    `Chi-square statistic: ` +
    `${summary.chiSquare.toFixed(3)} ` +
    `(36 df)`
);
console.log(
    `Start->winner offset entropy: ` +
    `${summary.offsetEntropy.toFixed(4)} / ` +
    `${summary.maxEntropy.toFixed(4)} bits ` +
    `(${summary.offsetEntropyPercent.toFixed(1)}%)`
);
console.log("");


console.log("============================================================");
console.log("COLOR COUNTS");
console.log("============================================================");

console.table([
    {
        color: "Red",
        count: summary.red,
        percent:
            (
                summary.red /
                Math.max(
                    summary.completed,
                    1
                ) *
                100
            ).toFixed(2)
    },
    {
        color: "Black",
        count: summary.black,
        percent:
            (
                summary.black /
                Math.max(
                    summary.completed,
                    1
                ) *
                100
            ).toFixed(2)
    },
    {
        color: "Green",
        count: summary.green,
        percent:
            (
                summary.green /
                Math.max(
                    summary.completed,
                    1
                ) *
                100
            ).toFixed(2)
    }
]);


console.log("============================================================");
console.log("NUMBER COUNTS");
console.log("============================================================");

console.table(
    rouletteNumbers.map(
        (number, index) => ({
            number,
            color:
                getColor(number),
            count:
                summary.numberCounts[
                    index
                ],
            percent:
                (
                    summary.numberCounts[
                        index
                    ] /
                    Math.max(
                        summary.completed,
                        1
                    ) *
                    100
                ).toFixed(2),
            expected:
                summary.expectedPerNumber
                    .toFixed(2)
        })
    )
);


console.log("============================================================");
console.log("TOP START->WINNER OFFSETS");
console.log("============================================================");

console.log(
    "If only one or two offsets dominate, the result may be " +
    "predictable from the starting position even if raw number " +
    "counts look uniform."
);

console.table(
    summary.offsetCounts
        .map(
            (count, offset) => ({
                offset,
                count,
                percent:
                    (
                        count /
                        Math.max(
                            summary.completed,
                            1
                        ) *
                        100
                    ).toFixed(2)
            })
        )
        .sort(
            (a, b) =>
                b.count - a.count
        )
        .slice(
            0,
            15
        )
);


// ============================================================
// WRITE RESULTS
// ============================================================

const outputDirectory =
    path.resolve(
        process.cwd(),
        "simulation-results"
    );

fs.mkdirSync(
    outputDirectory,
    {
        recursive: true
    }
);

const timestamp =
    new Date()
        .toISOString()
        .replace(
            /[:.]/g,
            "-"
        );

const csvPath =
    path.join(
        outputDirectory,
        `roulette_${trials}_spins_${timestamp}.csv`
    );

const jsonPath =
    path.join(
        outputDirectory,
        `roulette_${trials}_summary_${timestamp}.json`
    );

fs.writeFileSync(
    csvPath,
    makeCsv(results),
    "utf8"
);

fs.writeFileSync(
    jsonPath,
    JSON.stringify(
        {
            trials,
            elapsedSeconds,
            summary
        },
        null,
        2
    ),
    "utf8"
);


console.log("");
console.log("============================================================");
console.log("FILES WRITTEN");
console.log("============================================================");
console.log(csvPath);
console.log(jsonPath);
console.log("");

world.free();


})().catch(
    error => {
        console.error("");
        console.error(
            "Roulette batch test failed:"
        );
        console.error(
            error
        );
        process.exitCode = 1;
    }
);
