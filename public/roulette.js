import * as THREE from "/vendor/three.module.js";
import RAPIER from "/vendor/rapier.mjs";

await RAPIER.init();

// ============================================================
// FRESH FREE-PHYSICS ROULETTE TABLE
// ============================================================
//
// OBS VISIBILITY REVISION:
// Physics and bowl geometry are preserved from the supplied
// preferred version.
//
// Added visual-only "numbered crown":
// - thicker divider lanes climb the upper bowl
// - lanes continue across a flat outward lip
// - each lip sector gets a large colored number marker
// - current rotor sector flashes yellow while the ball is
//   inside that section
// - the highlight stops immediately when the ball leaves
//
// No crown element has a Rapier collider.
// ============================================================
//
// Foundation:
// - one smooth continuous outer bowl
// - one ball launched at a random speed from 11.5 to 12.5
// - Rapier owns the ball from frame zero
// - no guided orbit
// - no handoff
// - no scripted inward force
// - no scripted position correction
//
// Roulette additions:
// - 37 European pockets
// - physical pocket floor
// - physical low dividers
// - physical center hub
// - wooden table body
// - brass trim / spindle
//
// The bowl stays fully free-physics, but is now tuned for a
// randomized 11.5-12.5 launch and a decisive transition into
// the roulette rotor.
//
// IMPORTANT:
// The revolution counter is MEASUREMENT ONLY.
// It never changes the ball's motion.
// ============================================================


// ============================================================
// TUNING
// ============================================================

const FIXED_TIME_STEP = 1 / 240;

const BALL_RADIUS = 0.14;

// Randomized once each time this roulette simulation starts.
const BALL_START_SPEED_MIN = 11.5;
const BALL_START_SPEED_MAX = 12.5;

const BALL_START_SPEED =
    BALL_START_SPEED_MIN +
    Math.random() *
    (
        BALL_START_SPEED_MAX -
        BALL_START_SPEED_MIN
    );

// Overall roulette dimensions.
const TABLE_RADIUS = 5.55;

const BOWL_INNER_RADIUS = 2.70;
const BOWL_OUTER_RADIUS = 5.00;

// The bowl now meets the numbered rotor at exactly the same
// height. There is no physical step/lip between them.
const BOWL_BASE_Y = -0.02;

// Faster launch starts farther out, on the portion of the bank
// naturally matched to about a 12-speed circular orbit.
const BALL_START_CONTACT_RADIUS = 4.835;

// ------------------------------------------------------------
// NEW BOWL PROFILE
// ------------------------------------------------------------
//
// The old bowl got most of its slope from one very tall outer
// power curve. That made the front wall tall enough to hide the
// near-side roulette numbers.
//
// This version splits the shape into:
//
// 1) a SHORT, STEEPER inner funnel near the rotor
// 2) a LOW outer bank whose steepness is concentrated near the
//    outside edge
//
// Result:
// - outer rim is dramatically lower
// - 12-speed launch is still supported
// - the inner bowl now pulls the ball toward the pockets more
//   aggressively once its speed starts to fall
// - the bowl meets the rotor floor flush
//
const INNER_BASE_SLOPE = 0.45;

const OUTER_RISE = 1.63;
const OUTER_POWER = 5.0;

// Main orbit-duration tuning knob.
//
// LOWER  = ball stays in bowl longer.
// HIGHER = ball reaches rotor sooner.
//
// This is deliberately modest so the geometry does most
// of the work.
const ROLLING_DRAG = 0.14;

// Contact settings.
const BALL_FRICTION = 0.55;
const BOWL_FRICTION = 0.55;

// Restitution is zero throughout the important surfaces.
const ZERO_BOUNCE = 0.0;

// High mesh density for a smooth bowl.
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


// ============================================================
// OBS NUMBERED CROWN - VISUAL ONLY
// ============================================================
//
// Every pocket divider gets a matching visual lane that climbs
// the upper bowl.
//
// At the outer rim the lanes continue across a horizontal lip.
// Each sector on that lip gets a large red / black / green
// number marker.
//
// NONE of this geometry has a Rapier collider.
// It cannot affect the ball.
// ============================================================

const CROWN_LIP_INNER_RADIUS =
    BOWL_OUTER_RADIUS + 0.03;

const CROWN_LIP_OUTER_RADIUS =
    6.18;

const CROWN_LIP_Y_OFFSET =
    0.035;

const CROWN_LANE_RADIUS =
    0.030;

const CROWN_LANE_Y_OFFSET =
    0.018;

const CROWN_NUMBER_RADIUS =
    (
        CROWN_LIP_INNER_RADIUS +
        CROWN_LIP_OUTER_RADIUS
    ) / 2;

const CROWN_NUMBER_SIZE =
    0.92;

// Pocket ring.
const ROTOR_OUTER_RADIUS = 2.70;
const ROTOR_INNER_RADIUS = 1.58;

// The floor sits just below the inner edge of the bowl.
// This keeps the transition shallow rather than making
// the ball free-fall into the wheel.
const ROTOR_FLOOR_TOP_Y = BOWL_BASE_Y;
const ROTOR_FLOOR_HALF_HEIGHT = 0.08;

// Low frets: enough to define pockets, not tall pegs.
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


// ============================================================
// SCENE
// ============================================================

const scene =
    new THREE.Scene();

const camera =
    new THREE.PerspectiveCamera(
        42,
        window.innerWidth /
            window.innerHeight,
        0.1,
        100
    );

// OBS-FRIENDLY CAMERA.
//
// Presentation only: the physical bowl is unchanged.
//
// A substantially more top-down angle exposes much more of the
// numbered rotor while still keeping enough perspective to read
// the object as a 3D roulette table.
camera.position.set(
    0,
    13.6,
    7.7
);

camera.lookAt(
    0,
    0.8,
    0
);

const renderer =
    new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
);

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setClearColor(
    0x000000,
    0
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type =
    THREE.PCFSoftShadowMap;

document.body.appendChild(
    renderer.domElement
);


// ============================================================
// OBS WINNER DISPLAY
// ============================================================
//
// Presentation only.
// The winning pocket is still determined by the ball's actual
// final physical position.
//
// At small stream-widget sizes, 37 printed pocket numbers will
// never all be perfectly legible. This makes the result obvious
// without changing how the winner is determined.
// ============================================================

const winnerDisplay =
    document.createElement(
        "div"
    );

winnerDisplay.style.position =
    "absolute";

winnerDisplay.style.left =
    "50%";

winnerDisplay.style.top =
    "5%";

winnerDisplay.style.transform =
    "translateX(-50%)";

winnerDisplay.style.padding =
    "8px 14px";

winnerDisplay.style.border =
    "2px solid rgba(218, 190, 104, 0.9)";

winnerDisplay.style.borderRadius =
    "9px";

winnerDisplay.style.background =
    "rgba(0, 0, 0, 0.82)";

winnerDisplay.style.color =
    "white";

winnerDisplay.style.fontFamily =
    "Arial, sans-serif";

winnerDisplay.style.fontWeight =
    "900";

winnerDisplay.style.fontSize =
    "clamp(22px, 5vw, 56px)";

winnerDisplay.style.lineHeight =
    "1";

winnerDisplay.style.whiteSpace =
    "nowrap";

winnerDisplay.style.pointerEvents =
    "none";

winnerDisplay.style.display =
    "none";

winnerDisplay.style.zIndex =
    "20";

document.body.appendChild(
    winnerDisplay
);


function showWinningNumber(
    number
) {
    let colorName;

    if (
        number === 0
    ) {
        colorName =
            "GREEN";

    } else if (
        redNumbers.has(
            number
        )
    ) {
        colorName =
            "RED";

    } else {
        colorName =
            "BLACK";
    }

    winnerDisplay.textContent =
        `${colorName} ${number}`;

    winnerDisplay.style.display =
        "block";
}


// ============================================================
// LIGHTING
// ============================================================

scene.add(
    new THREE.HemisphereLight(
        0xffffff,
        0x24303a,
        1.8
    )
);

const keyLight =
    new THREE.DirectionalLight(
        0xffffff,
        3.0
    );

keyLight.position.set(
    4,
    9,
    5
);

keyLight.castShadow = true;

scene.add(
    keyLight
);

const fillLight =
    new THREE.DirectionalLight(
        0x9fc8ff,
        0.85
    );

fillLight.position.set(
    -5,
    4,
    -4
);

scene.add(
    fillLight
);


// ============================================================
// PHYSICS WORLD
// ============================================================

const physicsWorld =
    new RAPIER.World({
        x: 0,
        y: -9.81,
        z: 0
    });

physicsWorld.timestep =
    FIXED_TIME_STEP;


// ============================================================
// GROUPS
// ============================================================

const tableGroup =
    new THREE.Group();

const rotorGroup =
    new THREE.Group();

scene.add(
    tableGroup
);

scene.add(
    rotorGroup
);


// ============================================================
// WOODEN TABLE BODY
// ============================================================

const tableBaseGeometry =
    new THREE.CylinderGeometry(
        TABLE_RADIUS,
        TABLE_RADIUS,
        0.72,
        192
    );

const tableBaseMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x4b2817,
        roughness: 0.40,
        metalness: 0.04
    });

const tableBase =
    new THREE.Mesh(
        tableBaseGeometry,
        tableBaseMaterial
    );

tableBase.position.y =
    -0.43;

tableBase.receiveShadow = true;

tableGroup.add(
    tableBase
);


// ============================================================
// OUTER GREEN FELT BAND
// ============================================================

const feltGeometry =
    new THREE.RingGeometry(
        5.03,
        5.48,
        256
    );

const feltMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x154d2a,
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.DoubleSide
    });

const feltBand =
    new THREE.Mesh(
        feltGeometry,
        feltMaterial
    );

feltBand.rotation.x =
    -Math.PI / 2;

feltBand.position.y =
    -0.055;

tableGroup.add(
    feltBand
);


// ============================================================
// OUTER BRASS TRIM
// ============================================================

const outerTrimGeometry =
    new THREE.TorusGeometry(
        5.13,
        0.075,
        18,
        256
    );

const brassMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xc5a34e,
        metalness: 0.78,
        roughness: 0.20
    });

const outerTrim =
    new THREE.Mesh(
        outerTrimGeometry,
        brassMaterial
    );

outerTrim.rotation.x =
    Math.PI / 2;

outerTrim.position.y =
    -0.005;

tableGroup.add(
    outerTrim
);


// ============================================================
// SMOOTH BOWL MATH
// ============================================================

function clamp01(value) {
    return Math.min(
        Math.max(
            value,
            0
        ),
        1
    );
}

function getBowlHeight(radius) {
    const distance =
        Math.max(
            radius - BOWL_INNER_RADIUS,
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
        INNER_BASE_SLOPE * distance +
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
            radius - BOWL_INNER_RADIUS,
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


// ============================================================
// BALL CONTACT POSITION ON SLOPED BOWL
// ============================================================

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
            slope *
                slope
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

    const centerY =
        surfaceY +
        BALL_RADIUS *
        upNormalAmount;

    return {
        x:
            Math.cos(angle) *
            centerRadius,

        y:
            centerY,

        z:
            Math.sin(angle) *
            centerRadius,

        centerRadius,

        slope,

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


// ============================================================
// BOWL PROFILE
// ============================================================

const bowlProfile = [];

for (
    let index = 0;
    index <
        BOWL_RADIAL_SAMPLES;
    index++
) {
    const t =
        index /
        (
            BOWL_RADIAL_SAMPLES -
            1
        );

    const radius =
        BOWL_INNER_RADIUS +
        (
            BOWL_OUTER_RADIUS -
            BOWL_INNER_RADIUS
        ) *
        t;

    bowlProfile.push({
        radius,

        height:
            getBowlHeight(
                radius
            )
    });
}


// ============================================================
// PHYSICAL BOWL
// ============================================================

function createBowlCollider() {
    const vertices = [];
    const indices = [];

    for (
        let ringIndex = 0;
        ringIndex <
            bowlProfile.length;
        ringIndex++
    ) {
        const ring =
            bowlProfile[
                ringIndex
            ];

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
            bowlProfile.length - 1;
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

    const colliderDescription =
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
            );

    physicsWorld.createCollider(
        colliderDescription
    );
}

createBowlCollider();


// ============================================================
// VISIBLE BOWL
// ============================================================

const bowlPoints =
    bowlProfile.map(
        point =>
            new THREE.Vector2(
                point.radius,
                point.height
            )
    );

const bowlGeometry =
    new THREE.LatheGeometry(
        bowlPoints,
        BOWL_ANGULAR_SEGMENTS
    );

bowlGeometry.computeVertexNormals();

const bowlMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xb89445,
        metalness: 0.34,
        roughness: 0.30,
        side: THREE.DoubleSide
    });

const bowlMesh =
    new THREE.Mesh(
        bowlGeometry,
        bowlMaterial
    );

bowlMesh.receiveShadow = true;

scene.add(
    bowlMesh
);


// ============================================================
// OBS NUMBERED CROWN
// ============================================================
//
// This is deliberately created AFTER the main bowl so the
// divider lanes sit just above the visible bowl surface.
//
// Again: visual only. No Rapier colliders are created here.
// ============================================================

const crownLineMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.16,
        roughness: 0.45,
        emissive: 0x000000,
        emissiveIntensity: 0.0
    });

const crownLipY =
    getBowlHeight(
        BOWL_OUTER_RADIUS
    ) +
    CROWN_LIP_Y_OFFSET;


// ------------------------------------------------------------
// FLAT OUTER LIP
// ------------------------------------------------------------

const crownLipGeometry =
    new THREE.RingGeometry(
        CROWN_LIP_INNER_RADIUS,
        CROWN_LIP_OUTER_RADIUS,
        256
    );

const crownLipMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x5a421c,
        metalness: 0.26,
        roughness: 0.42,
        side: THREE.DoubleSide
    });

const crownLip =
    new THREE.Mesh(
        crownLipGeometry,
        crownLipMaterial
    );

crownLip.rotation.x =
    -Math.PI / 2;

crownLip.position.y =
    crownLipY;

scene.add(
    crownLip
);


// ------------------------------------------------------------
// HELPER: MAKE ONE CURVED DIVIDER LANE UP THE BOWL
// ------------------------------------------------------------

function createBowlDividerLane(
    angle
) {
    const points = [];

    const SAMPLE_COUNT = 48;

    for (
        let index = 0;
        index < SAMPLE_COUNT;
        index++
    ) {
        const t =
            index /
            (
                SAMPLE_COUNT - 1
            );

        const radius =
            BOWL_INNER_RADIUS +
            (
                BOWL_OUTER_RADIUS -
                BOWL_INNER_RADIUS
            ) *
            t;

        const y =
            getBowlHeight(
                radius
            ) +
            CROWN_LANE_Y_OFFSET;

        points.push(
            new THREE.Vector3(
                Math.cos(angle) *
                    radius,
                y,
                Math.sin(angle) *
                    radius
            )
        );
    }

    const curve =
        new THREE.CatmullRomCurve3(
            points
        );

    const geometry =
        new THREE.TubeGeometry(
            curve,
            64,
            CROWN_LANE_RADIUS,
            5,
            false
        );

    const lane =
        new THREE.Mesh(
            geometry,
            crownLineMaterial
        );

    scene.add(
        lane
    );
}


// ------------------------------------------------------------
// HELPER: MAKE ONE FLAT DIVIDER LINE ACROSS THE LIP
// ------------------------------------------------------------

function createLipDividerLine(
    angle
) {
    const length =
        CROWN_LIP_OUTER_RADIUS -
        CROWN_LIP_INNER_RADIUS;

    const middleRadius =
        (
            CROWN_LIP_OUTER_RADIUS +
            CROWN_LIP_INNER_RADIUS
        ) / 2;

    const geometry =
        new THREE.BoxGeometry(
            length,
            0.032,
            0.065
        );

    const line =
        new THREE.Mesh(
            geometry,
            crownLineMaterial
        );

    line.position.set(
        Math.cos(angle) *
            middleRadius,
        crownLipY +
            0.012,
        Math.sin(angle) *
            middleRadius
    );

    line.rotation.y =
        -angle;

    scene.add(
        line
    );
}


// ------------------------------------------------------------
// HELPER: LARGE COLORED NUMBER DISC
// ------------------------------------------------------------

const crownMarkers = [];
const crownMarkerHalos = [];

let currentRotorPocketIndex =
    null;

let winningCrownPocketIndex =
    null;

// Active crown sector while the ball is currently inside a
// numbered rotor section. This is updated live and cleared
// immediately when the ball leaves that section.
let activeCrownPocketIndex =
    null;


// ------------------------------------------------------------
// HELPER: FLASH HALO AROUND A CROWN NUMBER
// ------------------------------------------------------------

function createCrownFlashHalo() {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 320;
    canvas.height = 320;

    const context =
        canvas.getContext(
            "2d"
        );

    context.clearRect(
        0,
        0,
        320,
        320
    );

    // Strong yellow highlight that sits behind the crown marker.
    context.beginPath();

    context.arc(
        160,
        160,
        144,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        "rgba(255, 232, 70, 0.42)";

    context.fill();

    context.beginPath();

    context.arc(
        160,
        160,
        147,
        0,
        Math.PI * 2
    );

    context.lineWidth = 18;
    context.strokeStyle =
        "rgba(255, 229, 80, 1.0)";

    context.stroke();

    context.beginPath();

    context.arc(
        160,
        160,
        158,
        0,
        Math.PI * 2
    );

    context.lineWidth = 18;
    context.strokeStyle =
        "rgba(255, 243, 160, 0.55)";

    context.stroke();

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

    const sprite =
        new THREE.Sprite(
            material
        );

    sprite.scale.set(
        CROWN_NUMBER_SIZE * 1.42,
        CROWN_NUMBER_SIZE * 1.42,
        1
    );

    return sprite;
}


function updateCrownFlashes(
    currentTime
) {
    for (
        let index = 0;
        index < POCKET_COUNT;
        index++
    ) {
        const marker =
            crownMarkers[
                index
            ];

        const halo =
            crownMarkerHalos[
                index
            ];

        if (
            !marker ||
            !halo
        ) {
            continue;
        }

        const isActive =
            enteredRotor &&
            activeCrownPocketIndex ===
                index;

        let intensity = 0;

        if (
            isActive
        ) {
            // Flash yellow ONLY while the ball is inside this
            // section. As soon as the ball leaves, the highlight
            // turns off because activeCrownPocketIndex changes.
            intensity =
                0.72 +
                0.28 *
                Math.sin(
                    currentTime *
                    0.022
                );
        }

        intensity =
            Math.max(
                0,
                Math.min(
                    intensity,
                    1
                )
            );

        halo.material.opacity =
            intensity;

        const markerScale =
            CROWN_NUMBER_SIZE *
            (
                1 +
                intensity *
                0.10
            );

        marker.scale.set(
            markerScale,
            markerScale,
            1
        );

        const haloScale =
            CROWN_NUMBER_SIZE *
            (
                1.42 +
                intensity *
                0.10
            );

        halo.scale.set(
            haloScale,
            haloScale,
            1
        );
    }
}


function createCrownNumberMarker(
    number
) {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 320;
    canvas.height = 320;

    const context =
        canvas.getContext(
            "2d"
        );

    let fillColor;

    if (
        number === 0
    ) {
        fillColor =
            "#168347";

    } else if (
        redNumbers.has(
            number
        )
    ) {
        fillColor =
            "#b52328";

    } else {
        fillColor =
            "#171717";
    }

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.beginPath();

    context.arc(
        160,
        160,
        142,
        0,
        Math.PI * 2
    );

    context.fillStyle =
        fillColor;

    context.fill();

    context.lineWidth =
        14;

    context.strokeStyle =
        "#e4c978";

    context.stroke();

    context.font =
        "bold 150px Arial";

    context.textAlign =
        "center";

    context.textBaseline =
        "middle";

    context.fillStyle =
        "white";

    context.strokeStyle =
        "rgba(0, 0, 0, 0.7)";

    context.lineWidth =
        9;

    context.strokeText(
        String(number),
        160,
        166
    );

    context.fillText(
        String(number),
        160,
        166
    );

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });

    const sprite =
        new THREE.Sprite(
            material
        );

    sprite.scale.set(
        CROWN_NUMBER_SIZE,
        CROWN_NUMBER_SIZE,
        1
    );

    return sprite;
}


// ------------------------------------------------------------
// BUILD ALL 37 LANES + LIP SECTORS + LARGE NUMBERS
// ------------------------------------------------------------

for (
    let index = 0;
    index < POCKET_COUNT;
    index++
) {
    // Divider boundary.
    const dividerAngle =
        index *
        POCKET_ANGLE;

    createBowlDividerLane(
        dividerAngle
    );

    createLipDividerLine(
        dividerAngle
    );


    // Number sits centered inside the corresponding sector.
    const numberAngle =
        (
            index +
            0.5
        ) *
        POCKET_ANGLE;

    const number =
        rouletteNumbers[
            index
        ];

    const marker =
        createCrownNumberMarker(
            number
        );

    marker.position.set(
        Math.cos(numberAngle) *
            CROWN_NUMBER_RADIUS,

        crownLipY +
            0.075,

        Math.sin(numberAngle) *
            CROWN_NUMBER_RADIUS
    );

    const halo =
        createCrownFlashHalo();

    halo.position.copy(
        marker.position
    );

    // Put halo microscopically behind the number sprite so the
    // text remains crisp while the outer circle flashes.
    halo.position.y -=
        0.002;

    crownMarkers[
        index
    ] =
        marker;

    crownMarkerHalos[
        index
    ] =
        halo;

    scene.add(
        halo
    );

    scene.add(
        marker
    );
}


// ------------------------------------------------------------
// OUTER EDGE TRIM FOR THE CROWN
// ------------------------------------------------------------

const crownOuterTrimGeometry =
    new THREE.TorusGeometry(
        CROWN_LIP_OUTER_RADIUS,
        0.035,
        10,
        256
    );

const crownOuterTrim =
    new THREE.Mesh(
        crownOuterTrimGeometry,
        crownLineMaterial
    );

crownOuterTrim.rotation.x =
    Math.PI / 2;

crownOuterTrim.position.y =
    crownLipY +
    0.015;

scene.add(
    crownOuterTrim
);


// ============================================================
// FLUSH INNER BRASS TRIM
// ============================================================
//
// Decorative only.
//
// The old torus looked like a raised lip even though it was not
// physical. This is now a thin FLAT ring sitting at the exact
// bowl/rotor transition height.
// ============================================================

const innerTrimGeometry =
    new THREE.RingGeometry(
        BOWL_INNER_RADIUS - 0.028,
        BOWL_INNER_RADIUS + 0.028,
        256
    );

const innerTrim =
    new THREE.Mesh(
        innerTrimGeometry,
        brassMaterial
    );

innerTrim.rotation.x =
    -Math.PI / 2;

innerTrim.position.y =
    BOWL_BASE_Y +
    0.006;

scene.add(
    innerTrim
);


// ============================================================
// ROTOR FLOOR - PHYSICAL
// ============================================================
//
// The rotor floor is now EXACTLY flush with the inner edge of
// the bowl. There is no vertical collision lip to wait for.
//
// The steeper inner funnel therefore feeds the ball directly
// onto the numbered rotor while it still has useful speed.
// Restitution remains zero.
// ============================================================

const rotorFloorBody =
    physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc
            .fixed()
    );

physicsWorld.createCollider(
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


// ============================================================
// VISIBLE POCKET WEDGES
// ============================================================

for (
    let index = 0;
    index <
        POCKET_COUNT;
    index++
) {
    const number =
        rouletteNumbers[
            index
        ];

    let color;

    if (
        number === 0
    ) {
        color =
            0x14733a;

    } else if (
        redNumbers.has(
            number
        )
    ) {
        color =
            0x9f2323;

    } else {
        color =
            0x151515;
    }

    const geometry =
        new THREE.RingGeometry(
            ROTOR_INNER_RADIUS,
            ROTOR_OUTER_RADIUS,
            8,
            1,
            index *
                POCKET_ANGLE,
            POCKET_ANGLE *
                0.975
        );

    const material =
        new THREE.MeshStandardMaterial({
            color,
            roughness: 0.63,
            metalness: 0.02,
            side: THREE.DoubleSide
        });

    const pocket =
        new THREE.Mesh(
            geometry,
            material
        );

    // RingGeometry is authored in XY space. Rotating it -90°
// mirrored the wedge angle relative to the number labels and
// divider geometry. That is why the green 0 color appeared
// under 26 while the printed numbers themselves looked right.
//
// +90° keeps the inner wedge colors in the same angular
// direction as the labels, crown, and dividers.
pocket.rotation.x =
        Math.PI / 2;

    pocket.position.y =
        ROTOR_FLOOR_TOP_Y +
        0.004;

    pocket.receiveShadow = true;

    rotorGroup.add(
        pocket
    );
}


// ============================================================
// NUMBER LABEL HELPER
// ============================================================

function createNumberLabel(
    number
) {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 256;
    canvas.height = 128;

    const context =
        canvas.getContext(
            "2d"
        );

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.font =
        "bold 76px Arial";

    context.textAlign =
        "center";

    context.textBaseline =
        "middle";

    context.fillStyle =
        "white";

    context.strokeStyle =
        "rgba(0, 0, 0, 0.65)";

    context.lineWidth = 8;

    context.strokeText(
        String(number),
        canvas.width / 2,
        canvas.height / 2
    );

    context.fillText(
        String(number),
        canvas.width / 2,
        canvas.height / 2
    );

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const material =
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });

    const sprite =
        new THREE.Sprite(
            material
        );

    sprite.scale.set(
        0.50,
        0.25,
        1
    );

    return sprite;
}


// ============================================================
// PHYSICAL + VISIBLE POCKET DIVIDERS
// ============================================================

const dividerVisualGeometry =
    new THREE.BoxGeometry(
        DIVIDER_LENGTH,
        DIVIDER_HEIGHT,
        DIVIDER_THICKNESS
    );

for (
    let index = 0;
    index <
        POCKET_COUNT;
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

    const rotation = {
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
    };

    const dividerCollider =
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
            .setRotation(
                rotation
            )
            .setFriction(
                0.72
            )
            .setRestitution(
                ZERO_BOUNCE
            );

    physicsWorld.createCollider(
        dividerCollider
    );

    const divider =
        new THREE.Mesh(
            dividerVisualGeometry,
            brassMaterial
        );

    divider.position.set(
        x,
        ROTOR_FLOOR_TOP_Y +
            DIVIDER_HEIGHT / 2,
        z
    );

    divider.rotation.y =
        -angle;

    divider.castShadow = true;
    divider.receiveShadow = true;

    rotorGroup.add(
        divider
    );
}


// ============================================================
// NUMBER LABELS
// ============================================================

for (
    let index = 0;
    index <
        POCKET_COUNT;
    index++
) {
    const number =
        rouletteNumbers[
            index
        ];

    const angle =
        (
            index +
            0.5
        ) *
        POCKET_ANGLE;

    const labelRadius =
        2.22;

    const label =
        createNumberLabel(
            number
        );

    label.position.set(
        Math.cos(angle) *
            labelRadius,

        ROTOR_FLOOR_TOP_Y +
            0.13,

        Math.sin(angle) *
            labelRadius
    );

    rotorGroup.add(
        label
    );
}


// ============================================================
// CENTER HUB - PHYSICAL
// ============================================================
//
// The hub keeps the ball in the numbered pocket ring.
// It is intentionally not a tall hard post.
// ============================================================

const CENTER_HUB_RADIUS =
    ROTOR_INNER_RADIUS -
    0.025;

const CENTER_HUB_HALF_HEIGHT =
    0.18;

const CENTER_HUB_CENTER_Y =
    ROTOR_FLOOR_TOP_Y +
    CENTER_HUB_HALF_HEIGHT;

const centerHubBody =
    physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc
            .fixed()
    );

physicsWorld.createCollider(
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


// ============================================================
// VISIBLE CENTER HUB
// ============================================================

const centerHubGeometry =
    new THREE.CylinderGeometry(
        1.20,
        CENTER_HUB_RADIUS,
        CENTER_HUB_HALF_HEIGHT *
            2,
        128
    );

const centerHubMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xb99a4a,
        metalness: 0.76,
        roughness: 0.22
    });

const centerHub =
    new THREE.Mesh(
        centerHubGeometry,
        centerHubMaterial
    );

centerHub.position.y =
    CENTER_HUB_CENTER_Y;

centerHub.castShadow = true;
centerHub.receiveShadow = true;

rotorGroup.add(
    centerHub
);


// ============================================================
// SPINDLE
// ============================================================

const spindleBaseGeometry =
    new THREE.CylinderGeometry(
        0.38,
        0.68,
        0.72,
        96
    );

const spindleBase =
    new THREE.Mesh(
        spindleBaseGeometry,
        brassMaterial
    );

spindleBase.position.y =
    0.49;

rotorGroup.add(
    spindleBase
);

const spindleTopGeometry =
    new THREE.SphereGeometry(
        0.26,
        32,
        24
    );

const spindleTop =
    new THREE.Mesh(
        spindleTopGeometry,
        brassMaterial
    );

spindleTop.scale.y =
    1.25;

spindleTop.position.y =
    0.98;

rotorGroup.add(
    spindleTop
);


// ============================================================
// BALL VISUAL
// ============================================================

const ballGeometry =
    new THREE.SphereGeometry(
        BALL_RADIUS,
        48,
        48
    );

const ballMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.08
    });

const ball =
    new THREE.Mesh(
        ballGeometry,
        ballMaterial
    );

ball.castShadow = true;
ball.receiveShadow = true;

scene.add(
    ball
);


// ============================================================
// BALL PHYSICS
// ============================================================
//
// Dynamic from frame zero.
// After launch there are NO later setTranslation() calls and
// NO later setLinvel() calls.
// ============================================================

// Random starting point around the SAME radial launch ring.
//
// We intentionally randomize the angle, not the radial depth.
// The launch ring is already tuned to the bowl shape and the
// 11.5-12.5 speed range. Randomizing radius would also change
// the bank slope and could produce very different launch physics.
const START_ANGLE =
    Math.random() *
    Math.PI *
    2;

// getBallCenterAtContact() offsets the sphere center along the
// local bowl normal. This keeps the ball exactly BALL_RADIUS away
// from the physical bowl surface regardless of START_ANGLE.
const start =
    getBallCenterAtContact(
        BALL_START_CONTACT_RADIUS,
        START_ANGLE
    );

const ballBodyDescription =
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
        );

const ballBody =
    physicsWorld.createRigidBody(
        ballBodyDescription
    );

const ballColliderDescription =
    RAPIER.ColliderDesc
        .ball(
            BALL_RADIUS
        )
        .setFriction(
            BALL_FRICTION
        )
        .setRestitution(
            ZERO_BOUNCE
        );

physicsWorld.createCollider(
    ballColliderDescription,
    ballBody
);

ballBody.enableCcd(
    true
);


// ============================================================
// RANDOMIZED TANGENTIAL LAUNCH
// ============================================================
//
// Bowl position around the launch ring is:
//
//     x = cos(angle) * radius
//     z = sin(angle) * radius
//
// The +angle tangent is therefore:
//
//     x = -sin(angle)
//     z =  cos(angle)
//
// Multiplying that unit tangent by BALL_START_SPEED gives the
// correct horizontal launch vector from ANY random start point.
// ============================================================

const launchVelocity = {
    x:
        -Math.sin(
            START_ANGLE
        ) *
        BALL_START_SPEED,

    y: 0,

    z:
        Math.cos(
            START_ANGLE
        ) *
        BALL_START_SPEED
};

ballBody.setLinvel(
    launchVelocity,
    true
);


// ============================================================
// MATCHING INITIAL ROLLING SPIN
// ============================================================

const startNormal =
    new THREE.Vector3(
        start.normal.x,
        start.normal.y,
        start.normal.z
    );

const startVelocity =
    new THREE.Vector3(
        launchVelocity.x,
        launchVelocity.y,
        launchVelocity.z
    );

const startAngularVelocity =
    new THREE.Vector3()
        .crossVectors(
            startNormal,
            startVelocity
        )
        .divideScalar(
            BALL_RADIUS
        );

ballBody.setAngvel(
    {
        x:
            startAngularVelocity.x,

        y:
            startAngularVelocity.y,

        z:
            startAngularVelocity.z
    },
    true
);


// ============================================================
// FREE-PHYSICS REVOLUTION MEASUREMENT
// ============================================================
//
// Measurement only.
// Never alters motion.
// ============================================================

let lastAngle =
    Math.atan2(
        start.z,
        start.x
    );

let accumulatedAngle = 0;
let freeRevolutions = 0;

let enteredRotor = false;
let settledPocketLogged = false;

function getCurrentPocketIndex(
    position
) {
    let angle =
        Math.atan2(
            position.z,
            position.x
        );

    if (angle < 0) {
        angle +=
            Math.PI * 2;
    }

    return (
        Math.floor(
            angle /
            POCKET_ANGLE
        ) %
        POCKET_COUNT
    );
}


function getCurrentPocketNumber(
    position
) {
    return rouletteNumbers[
        getCurrentPocketIndex(
            position
        )
    ];
}

function updateMeasurement() {
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

    if (
        !enteredRotor
    ) {
        let delta =
            angle -
            lastAngle;

        if (
            delta >
            Math.PI
        ) {
            delta -=
                Math.PI * 2;
        }

        if (
            delta <
            -Math.PI
        ) {
            delta +=
                Math.PI * 2;
        }

        accumulatedAngle +=
            Math.abs(
                delta
            );

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

            console.log(
                "BALL ENTERED ROULETTE ROTOR",
                "| free-physics revolutions:",
                freeRevolutions.toFixed(3)
            );
        }
    }

    lastAngle =
        angle;


    // --------------------------------------------------------
    // LIVE CROWN SECTOR FLASH
    // --------------------------------------------------------
    //
    // Once the ball has entered the numbered rotor, flash the
    // large crown marker every time its angular position moves
    // into a different numbered sector.
    //
    // Visual only. Does not alter the rigid body.
    // --------------------------------------------------------

    if (
        enteredRotor
    ) {
        const pocketIndex =
            getCurrentPocketIndex(
                position
            );

        currentRotorPocketIndex =
            pocketIndex;

        activeCrownPocketIndex =
            pocketIndex;
    } else {
        activeCrownPocketIndex =
            null;
    }


    if (
        enteredRotor &&
        !settledPocketLogged
    ) {
        const velocity =
            ballBody.linvel();

        const speed =
            Math.sqrt(
                velocity.x *
                    velocity.x +
                velocity.y *
                    velocity.y +
                velocity.z *
                    velocity.z
            );

        if (
            speed <
                0.22 &&
            radius >
                ROTOR_INNER_RADIUS &&
            radius <
                ROTOR_OUTER_RADIUS +
                    BALL_RADIUS
        ) {
            settledPocketLogged = true;

            const winningNumber =
                getCurrentPocketNumber(
                    position
                );

            console.log(
                "BALL SETTLED",
                "| number:",
                winningNumber,
                "| free revs before rotor:",
                freeRevolutions.toFixed(3)
            );

            showWinningNumber(
                winningNumber
            );

            winningCrownPocketIndex =
                getCurrentPocketIndex(
                    position
                );

            activeCrownPocketIndex =
                winningCrownPocketIndex;
        }
    }
}


// ============================================================
// STARTUP DEBUG
// ============================================================

const startNaturalOrbitSpeed =
    Math.sqrt(
        9.81 *
        start.centerRadius *
        start.slope
    );

console.log(
    "Fresh free-physics roulette started.",
    "| launch speed:",
    BALL_START_SPEED.toFixed(2),
    "| start contact radius:",
    BALL_START_CONTACT_RADIUS.toFixed(2),
    "| start center radius:",
    start.centerRadius.toFixed(2),
    "| bowl slope:",
    start.slope.toFixed(3),
    "| natural orbit speed:",
    startNaturalOrbitSpeed.toFixed(2),
    "| rolling drag:",
    ROLLING_DRAG.toFixed(3),
    "| start angle:",
    (
        START_ANGLE *
        180 /
        Math.PI
    ).toFixed(1) + "deg",
    "| launch vector:",
    `(${launchVelocity.x.toFixed(2)}, ${launchVelocity.y.toFixed(2)}, ${launchVelocity.z.toFixed(2)})`
);


// ============================================================
// ANIMATION
// ============================================================

let previousTime =
    performance.now();

let physicsAccumulator = 0;
let debugElapsed = 0;

function animate(
    currentTime
) {
    requestAnimationFrame(
        animate
    );

    let frameTime =
        (
            currentTime -
            previousTime
        ) /
        1000;

    previousTime =
        currentTime;

    frameTime =
        Math.min(
            frameTime,
            0.1
        );

    physicsAccumulator +=
        frameTime;

    while (
        physicsAccumulator >=
        FIXED_TIME_STEP
    ) {
        // The physics world is the ONLY thing advancing
        // the ball after launch.
        physicsWorld.step();

        updateMeasurement();

        physicsAccumulator -=
            FIXED_TIME_STEP;
    }

    const position =
        ballBody.translation();

    const rotation =
        ballBody.rotation();

    ball.position.set(
        position.x,
        position.y,
        position.z
    );

    ball.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );

    debugElapsed +=
        frameTime;

    if (
        debugElapsed >=
        0.5
    ) {
        debugElapsed = 0;

        const velocity =
            ballBody.linvel();

        const speed =
            Math.sqrt(
                velocity.x *
                    velocity.x +
                velocity.y *
                    velocity.y +
                velocity.z *
                    velocity.z
            );

        const radius =
            Math.sqrt(
                position.x *
                    position.x +
                position.z *
                    position.z
            );

        console.log(
            `Ball | ` +
            `phase: ${enteredRotor ? "ROTOR" : "BOWL"} | ` +
            `freeRevs: ${freeRevolutions.toFixed(2)} | ` +
            `radius: ${radius.toFixed(2)} | ` +
            `y: ${position.y.toFixed(2)} | ` +
            `speed: ${speed.toFixed(2)}`
        );
    }

    updateCrownFlashes(
        currentTime
    );

    renderer.render(
        scene,
        camera
    );
}

requestAnimationFrame(
    animate
);


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {
        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);
