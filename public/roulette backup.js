import * as THREE from "/vendor/three.module.js";
import RAPIER from "/vendor/rapier.mjs";

await RAPIER.init();

console.log("Rapier physics initialized.");


// ====================================================
// BASIC CONSTANTS
// ====================================================

const BALL_RADIUS = 0.14;

const FIXED_TIME_STEP = 1 / 120;


// ====================================================
// OUTER ORBIT SETTINGS
//
// THESE ARE DELIBERATELY BIASED TOWARD:
//
// - very fast
// - very smooth
// - too many rotations
//
// We can easily make it drop sooner later.
// ====================================================

const OUTER_ORBIT_RADIUS = 3.60;

const OUTER_START_SPEED = 25.0;

const OUTER_RELEASE_SPEED = 13.0;

const OUTER_SPEED_DECAY = 0.09;

const RELEASE_GUIDE_DURATION =
    2.00;

const RELEASE_GUIDE_END_RADIUS =
    3.48;

const RELEASE_GUIDE_END_TANGENT_SPEED =
    6.25;

// ====================================================
// FREE-PHYSICS SPEED LOSS
//
// Once Rapier takes over on the bowl, temporarily use
// stronger damping so the ball naturally loses enough
// speed to migrate inward over roughly 0.5 - 2 laps.
//
// Once it reaches the pocket dividers we restore the
// old damping so the pocket behavior stays roughly
// the same as it is now.
// ====================================================

const FREE_BOWL_LINEAR_DAMPING =
    0.14;


const POCKET_LINEAR_DAMPING =
    0.035;


const BALL_ANGULAR_DAMPING =
    0.015;


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


const pocketCount =
    rouletteNumbers.length;


const pocketAngle =
    (Math.PI * 2) /
    pocketCount;


// ====================================================
// SCENE
// ====================================================

const scene =
    new THREE.Scene();


// ====================================================
// PHYSICS
// ====================================================

const gravity = {
    x: 0,
    y: -9.81,
    z: 0
};


const physicsWorld =
    new RAPIER.World(
        gravity
    );


physicsWorld.timestep =
    FIXED_TIME_STEP;


let physicsAccumulator = 0;

let previousTime =
    performance.now();


// ====================================================
// CAMERA
// ====================================================

const camera =
    new THREE.PerspectiveCamera(
        45,
        window.innerWidth /
            window.innerHeight,
        0.1,
        100
    );


camera.position.set(
    0,
    8,
    9
);


camera.lookAt(
    0,
    0.2,
    0
);


// ====================================================
// RENDERER
// ====================================================

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


document.body.appendChild(
    renderer.domElement
);


// ====================================================
// LIGHTING
// ====================================================

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        1.5
    );


scene.add(
    ambientLight
);


const mainLight =
    new THREE.DirectionalLight(
        0xffffff,
        3
    );


mainLight.position.set(
    5,
    10,
    5
);


scene.add(
    mainLight
);


// ====================================================
// GROUPS
// ====================================================

const bowlGroup =
    new THREE.Group();


const rotorGroup =
    new THREE.Group();


scene.add(
    bowlGroup
);


scene.add(
    rotorGroup
);


// ====================================================
// WOODEN BASE
// ====================================================

const baseGeometry =
    new THREE.CylinderGeometry(
        4,
        4,
        0.6,
        128
    );


const baseMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x4a2412,
        roughness: 0.45,
        metalness: 0.1
    });


const base =
    new THREE.Mesh(
        baseGeometry,
        baseMaterial
    );


base.position.y =
    -0.3;


bowlGroup.add(
    base
);


// ====================================================
// OUTER BOWL PROFILE
//
// We are going back to a shallow, predictable track.
//
// The OUTER phase is guided, so the ball will not
// repeatedly smash into the outer wall.
//
// Once released, this physical slope carries it
// inward toward the rotor.
// ====================================================

const bowlProfile = [

    // =================================================
    // INNER EDGE
    //
    // Meets the rotor floor directly.
    //
    // This means there is no longer a gap underneath
    // the bowl for the ball to escape through.
    // =================================================

    {
        radius: 3.08,
        height: 0.17
    },


    // =================================================
    // INNER BANK
    //
    // Relatively shallow.
    //
    // As the ball loses speed, gravity will pull it
    // progressively farther inward through this area.
    // =================================================

    {
        radius: 3.20,
        height: 0.25
    },

    {
        radius: 3.32,
        height: 0.34
    },

    {
        radius: 3.45,
        height: 0.45
    },


    // =================================================
    // MAIN FREE-PHYSICS RACE
    //
    // This banking is deliberately strong enough to
    // let a ~6 unit/sec ball make genuine revolutions
    // instead of immediately shooting outward.
    // =================================================

    {
        radius: 3.55,
        height: 0.55
    },

    {
        radius: 3.60,
        height: 0.61
    },


    // =================================================
    // OUTER CATCHING BANK
    //
    // IMPORTANT:
    //
    // There is NO vertical wall anymore.
    //
    // If the ball gets thrown outward it must climb
    // progressively steeper bank instead.
    //
    // Gravity therefore pushes it back inward rather
    // than allowing a permanent wall orbit.
    // =================================================

    {
        radius: 3.72,
        height: 0.82
    },

    {
        radius: 3.84,
        height: 1.12
    },

    {
        radius: 3.96,
        height: 1.55
    }
];


// ====================================================
// FIND BOWL HEIGHT AT A GIVEN RADIUS
//
// Used so our guided orbit visually rests exactly on
// the outer physical surface.
// ====================================================

function getBowlHeightAtRadius(
    radius
) {

    for (
        let index = 0;
        index <
            bowlProfile.length - 1;
        index++
    ) {

        const a =
            bowlProfile[index];

        const b =
            bowlProfile[
                index + 1
            ];


        if (
            radius >= a.radius &&
            radius <= b.radius &&
            b.radius !== a.radius
        ) {

            const t =
                (
                    radius -
                    a.radius
                ) /
                (
                    b.radius -
                    a.radius
                );


            return (
                a.height +
                (
                    b.height -
                    a.height
                ) *
                t
            );
        }
    }


    return 0.62;
}


const OUTER_TRACK_SURFACE_Y =
    getBowlHeightAtRadius(
        OUTER_ORBIT_RADIUS
    );


const OUTER_ORBIT_Y =
    OUTER_TRACK_SURFACE_Y +
    BALL_RADIUS;


// ====================================================
// CONTINUOUS BOWL COLLIDER
// ====================================================

function createBowlCollider() {

    const SEGMENTS = 384;

    const vertices = [];
    const indices = [];


    // ------------------------------------------------
    // Circular vertex rings
    // ------------------------------------------------

    for (
        const ring of bowlProfile
    ) {

        for (
            let index = 0;
            index < SEGMENTS;
            index++
        ) {

            const angle =
                (
                    index /
                    SEGMENTS
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


    // ------------------------------------------------
    // Join rings
    // ------------------------------------------------

    for (
        let ringIndex = 0;
        ringIndex <
            bowlProfile.length - 1;
        ringIndex++
    ) {

        for (
            let index = 0;
            index < SEGMENTS;
            index++
        ) {

            const nextIndex =
                (
                    index + 1
                ) %
                SEGMENTS;


            const currentA =
                ringIndex *
                    SEGMENTS +
                index;


            const currentB =
                ringIndex *
                    SEGMENTS +
                nextIndex;


            const nextA =
                (
                    ringIndex + 1
                ) *
                    SEGMENTS +
                index;


            const nextB =
                (
                    ringIndex + 1
                ) *
                    SEGMENTS +
                nextIndex;


            indices.push(
                currentA,
                currentB,
                nextA
            );


            indices.push(
                currentB,
                nextB,
                nextA
            );
        }
    }


    const collider =
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
                0.025
            )

            .setRestitution(
                0.0
            );


    physicsWorld.createCollider(
        collider
    );


    console.log(
        "Smooth outer bowl collider created."
    );
}


createBowlCollider();


// ====================================================
// VISIBLE OUTER BOWL
// ====================================================

const bowlLathePoints =
    bowlProfile.map(
        point =>
            new THREE.Vector2(
                point.radius,
                point.height
            )
    );


const visibleBowlGeometry =
    new THREE.LatheGeometry(
        bowlLathePoints,
        384
    );


const visibleBowlMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xb68b36,
        metalness: 0.55,
        roughness: 0.28,
        side: THREE.DoubleSide
    });


const visibleBowl =
    new THREE.Mesh(
        visibleBowlGeometry,
        visibleBowlMaterial
    );


bowlGroup.add(
    visibleBowl
);


// ====================================================
// ROTOR
// ====================================================

const ROTOR_INNER_RADIUS =
    2.00;


const ROTOR_OUTER_RADIUS =
    3.20;


const ROTOR_FLOOR_Y =
    0.17;


// Physical floor is deliberately larger than the
// visible rotor.
//
// The ball should never be able to fall into space.
const ROTOR_PHYSICS_RADIUS =
    3.95;


const ROTOR_FLOOR_HALF_HEIGHT =
    0.10;


// ====================================================
// SOLID PHYSICAL ROTOR FLOOR
// ====================================================

const rotorFloorCollider =
    RAPIER.ColliderDesc
        .cylinder(
            ROTOR_FLOOR_HALF_HEIGHT,
            ROTOR_PHYSICS_RADIUS
        )

        .setTranslation(
            0,

            ROTOR_FLOOR_Y -
                ROTOR_FLOOR_HALF_HEIGHT,

            0
        )

        .setFriction(
            0.003
        )

        .setRestitution(
            0.10
        );


physicsWorld.createCollider(
    rotorFloorCollider
);


console.log(
    "Rotor floor collider created."
);


// ====================================================
// LOW OUTER POCKET RIM
//
// Prevents the ball from slowly wandering back out
// after entering the rotor.
// ====================================================

function createPocketOuterRim() {

    const SEGMENTS =
        256;


    const RADIUS =
        3.31;


    const BOTTOM_Y =
        ROTOR_FLOOR_Y;


    const TOP_Y =
        ROTOR_FLOOR_Y +
        0.065;


    const vertices = [];
    const indices = [];


    // Bottom ring.
    for (
        let index = 0;
        index < SEGMENTS;
        index++
    ) {

        const angle =
            (
                index /
                SEGMENTS
            ) *
                Math.PI *
                2;


        vertices.push(

            Math.cos(angle) *
                RADIUS,

            BOTTOM_Y,

            Math.sin(angle) *
                RADIUS
        );
    }


    // Top ring.
    for (
        let index = 0;
        index < SEGMENTS;
        index++
    ) {

        const angle =
            (
                index /
                SEGMENTS
            ) *
                Math.PI *
                2;


        vertices.push(

            Math.cos(angle) *
                RADIUS,

            TOP_Y,

            Math.sin(angle) *
                RADIUS
        );
    }


    for (
        let index = 0;
        index < SEGMENTS;
        index++
    ) {

        const nextIndex =
            (
                index + 1
            ) %
                SEGMENTS;


        const bottomA =
            index;


        const bottomB =
            nextIndex;


        const topA =
            SEGMENTS +
            index;


        const topB =
            SEGMENTS +
            nextIndex;


        indices.push(
            bottomA,
            bottomB,
            topA
        );


        indices.push(
            bottomB,
            topB,
            topA
        );
    }


    const rimCollider =
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
                0.001
            )

            .setRestitution(
                0.25
            );


    physicsWorld.createCollider(
        rimCollider
    );
}


createPocketOuterRim();


// ====================================================
// VISIBLE POCKET RIM
// ====================================================

const pocketRimGeometry =
    new THREE.TorusGeometry(
        3.31,
        0.03,
        10,
        192
    );


const pocketRimMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xd6bd70,
        metalness: 0.75,
        roughness: 0.22
    });


const pocketRim =
    new THREE.Mesh(
        pocketRimGeometry,
        pocketRimMaterial
    );


pocketRim.rotation.x =
    Math.PI / 2;


pocketRim.position.y =
    ROTOR_FLOOR_Y +
    0.03;


rotorGroup.add(
    pocketRim
);


// ====================================================
// POCKET DIMENSIONS
//
// Small frets.
//
// We want a fast incoming ball to be able to skip
// several before settling.
// ====================================================

const DIVIDER_INNER_RADIUS =
    2.08;


const DIVIDER_OUTER_RADIUS =
    3.08;


const DIVIDER_LENGTH =
    DIVIDER_OUTER_RADIUS -
    DIVIDER_INNER_RADIUS;


const DIVIDER_MIDDLE_RADIUS =
    (
        DIVIDER_INNER_RADIUS +
        DIVIDER_OUTER_RADIUS
    ) / 2;


const DIVIDER_HEIGHT =
    0.028;


const DIVIDER_THICKNESS =
    0.016;


// ====================================================
// VISIBLE POCKETS
// ====================================================

for (
    let index = 0;
    index < pocketCount;
    index++
) {

    const number =
        rouletteNumbers[index];


    let color;


    if (
        number === 0
    ) {

        color =
            0x16823c;

    } else if (
        redNumbers.has(
            number
        )
    ) {

        color =
            0xa82020;

    } else {

        color =
            0x181818;
    }


    const geometry =
        new THREE.RingGeometry(
            ROTOR_INNER_RADIUS,
            ROTOR_OUTER_RADIUS,

            5,
            1,

            index *
                pocketAngle,

            pocketAngle *
                0.975
        );


    const material =
        new THREE.MeshStandardMaterial({
            color,
            side:
                THREE.DoubleSide,
            roughness:
                0.65
        });


    const pocket =
        new THREE.Mesh(
            geometry,
            material
        );


    pocket.rotation.x =
        -Math.PI / 2;


    pocket.position.y =
        ROTOR_FLOOR_Y +
        0.006;


    rotorGroup.add(
        pocket
    );
}


// ====================================================
// NUMBER LABEL HELPER
// ====================================================

function createNumberLabel(
    number
) {

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        256;


    canvas.height =
        128;


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
        "bold 72px Arial";


    context.textAlign =
        "center";


    context.textBaseline =
        "middle";


    context.fillStyle =
        "white";


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
            transparent: true
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


// ====================================================
// PHYSICAL + VISIBLE DIVIDERS
// ====================================================

const dividerVisualGeometry =
    new THREE.BoxGeometry(
        DIVIDER_LENGTH,
        DIVIDER_HEIGHT,
        DIVIDER_THICKNESS
    );


const dividerVisualMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xd6bd70,
        metalness: 0.75,
        roughness: 0.22
    });


for (
    let index = 0;
    index < pocketCount;
    index++
) {

    const angle =
        index *
        pocketAngle;


    const x =
        Math.cos(angle) *
        DIVIDER_MIDDLE_RADIUS;


    const z =
        -Math.sin(angle) *
        DIVIDER_MIDDLE_RADIUS;


    const rotation = {
        x: 0,

        y:
            Math.sin(
                angle / 2
            ),

        z: 0,

        w:
            Math.cos(
                angle / 2
            )
    };


    // ------------------------------------------------
    // Physical divider
    // ------------------------------------------------

    const dividerCollider =
        RAPIER.ColliderDesc
            .cuboid(

                DIVIDER_LENGTH / 2,

                DIVIDER_HEIGHT / 2,

                DIVIDER_THICKNESS / 2
            )

            .setTranslation(
                x,

                ROTOR_FLOOR_Y +
                    DIVIDER_HEIGHT / 2,

                z
            )

            .setRotation(
                rotation
            )

            .setFriction(
                0.02
            )

            .setRestitution(
                0.38
            );


    physicsWorld.createCollider(
        dividerCollider
    );


    // ------------------------------------------------
    // Visible divider
    // ------------------------------------------------

    const divider =
        new THREE.Mesh(
            dividerVisualGeometry,
            dividerVisualMaterial
        );


    divider.position.set(
        x,

        ROTOR_FLOOR_Y +
            DIVIDER_HEIGHT / 2,

        z
    );


    divider.rotation.y =
        angle;


    rotorGroup.add(
        divider
    );
}


// ====================================================
// NUMBER LABELS
// ====================================================

for (
    let index = 0;
    index < pocketCount;
    index++
) {

    const number =
        rouletteNumbers[index];


    const angle =
        (
            index +
            0.5
        ) *
        pocketAngle;


    const labelRadius =
        2.62;


    const label =
        createNumberLabel(
            number
        );


    label.position.set(

        Math.cos(angle) *
            labelRadius,

        ROTOR_FLOOR_Y +
            0.10,

        -Math.sin(angle) *
            labelRadius
    );


    rotorGroup.add(
        label
    );
}


// ====================================================
// CENTER HUB
// ====================================================

const CENTER_RADIUS =
    1.93;


const CENTER_HALF_HEIGHT =
    0.28;


const CENTER_Y =
    ROTOR_FLOOR_Y +
    CENTER_HALF_HEIGHT;


const centerCollider =
    RAPIER.ColliderDesc
        .cylinder(
            CENTER_HALF_HEIGHT,
            CENTER_RADIUS
        )

        .setTranslation(
            0,
            CENTER_Y,
            0
        )

        .setFriction(
            0.02
        )

        .setRestitution(
            0.10
        );


physicsWorld.createCollider(
    centerCollider
);


// ====================================================
// VISIBLE CENTER HUB
// ====================================================

const centerGeometry =
    new THREE.CylinderGeometry(
        1.50,
        CENTER_RADIUS,
        CENTER_HALF_HEIGHT * 2,
        128
    );


const centerMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xc9a84f,
        metalness: 0.72,
        roughness: 0.24
    });


const centerHub =
    new THREE.Mesh(
        centerGeometry,
        centerMaterial
    );


centerHub.position.y =
    CENTER_Y;


rotorGroup.add(
    centerHub
);


// ====================================================
// SPINDLE
// ====================================================

const spindleGeometry =
    new THREE.CylinderGeometry(
        0.30,
        0.55,
        1.10,
        64
    );


const spindleMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xd3b55d,
        metalness: 0.85,
        roughness: 0.16
    });


const spindle =
    new THREE.Mesh(
        spindleGeometry,
        spindleMaterial
    );


spindle.position.y =
    0.95;


rotorGroup.add(
    spindle
);


// ====================================================
// BALL
// ====================================================

const ballGeometry =
    new THREE.SphereGeometry(
        BALL_RADIUS,
        32,
        32
    );


const ballMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.18
    });


const ball =
    new THREE.Mesh(
        ballGeometry,
        ballMaterial
    );


scene.add(
    ball
);


// ====================================================
// PHYSICAL BALL
//
// Damping is essentially disabled here.
//
// During the outer phase we control the speed decay
// ourselves.
//
// After release, friction/collisions take over.
// ====================================================

const ballBodyDescription =
    RAPIER.RigidBodyDesc
        .dynamic()

        .setTranslation(
            OUTER_ORBIT_RADIUS,
            OUTER_ORBIT_Y,
            0
        )

        .setLinearDamping(
        POCKET_LINEAR_DAMPING
    )

    .setAngularDamping(
        BALL_ANGULAR_DAMPING
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
            0.002
        )

        .setRestitution(
            0.0
        );


physicsWorld.createCollider(
    ballColliderDescription,
    ballBody
);


ballBody.enableCcd(
    true
);


// ====================================================
// BALL PHASE
// ====================================================

let ballPhase =
    "OUTER";


let guidedAngle =
    0;


let guidedSpeed =
    OUTER_START_SPEED;


let guidedRevolutions =
    0;

// ====================================================
// RELEASE GUIDE STATE
// ====================================================

let releaseGuideElapsed =
    0;


let releaseGuideStartSpeed =
    OUTER_RELEASE_SPEED;


let releaseGuidePreviousPosition =
    null;


// ====================================================
// INITIAL BALL STATE
// ====================================================

ballBody.setLinvel(
    {
        x: 0,
        y: 0,
        z: guidedSpeed
    },
    true
);


ballBody.setAngvel(
    {
        x:
            guidedSpeed /
            BALL_RADIUS,

        y: 0,
        z: 0
    },
    true
);


// ====================================================
// GUIDED OUTER ORBIT
//
// This deliberately overrides tiny collision/gravity
// errors while the ball is in the fast outer phase.
//
// The path is therefore mathematically smooth.
//
// The ball still has a real Rapier rigid body.
//
// Once released, we STOP doing this completely.
// ====================================================

function updateGuidedOuterOrbit() {

    if (
        ballPhase !== "OUTER"
    ) {

        return;
    }


    // Smooth exponential loss of speed.
    guidedSpeed *=
        Math.exp(
            -OUTER_SPEED_DECAY *
            FIXED_TIME_STEP
        );


    // Angular velocity around wheel:
    //
    // omega = linear speed / radius
    guidedAngle +=
        (
            guidedSpeed /
            OUTER_ORBIT_RADIUS
        ) *
        FIXED_TIME_STEP;


    guidedRevolutions =
        guidedAngle /
        (
            Math.PI *
            2
        );


    const cos =
        Math.cos(
            guidedAngle
        );


    const sin =
        Math.sin(
            guidedAngle
        );


    // ------------------------------------------------
    // Exact circular position
    // ------------------------------------------------

    const x =
        cos *
        OUTER_ORBIT_RADIUS;


    const z =
        sin *
        OUTER_ORBIT_RADIUS;


    ballBody.setTranslation(
        {
            x,
            y:
                OUTER_ORBIT_Y,
            z
        },
        true
    );


    // ------------------------------------------------
    // Exact tangent velocity
    //
    // At angle zero:
    //
    // x = +radius
    // z = 0
    //
    // and velocity = +Z.
    // ------------------------------------------------

    const tangentX =
        -sin;


    const tangentZ =
        cos;


    ballBody.setLinvel(
        {
            x:
                tangentX *
                guidedSpeed,

            y: 0,

            z:
                tangentZ *
                guidedSpeed
        },
        true
    );


    // ------------------------------------------------
    // Ball rolling spin
    //
    // Spin axis follows radial direction.
    // ------------------------------------------------

    const spinSpeed =
        guidedSpeed /
        BALL_RADIUS;


    ballBody.setAngvel(
        {
            x:
                cos *
                spinSpeed,

            y: 0,

            z:
                sin *
                spinSpeed
        },
        true
    );


    // ------------------------------------------------
    // Release
    // ------------------------------------------------

    if (
        guidedSpeed <=
        OUTER_RELEASE_SPEED
    ) {

        releaseBallFromOuterTrack(
            cos,
            sin,
            tangentX,
            tangentZ
        );
    }
}


// ====================================================
// RELEASE FROM OUTER TRACK
// ====================================================

// ====================================================
// BEGIN SMOOTH RELEASE FROM OUTER TRACK
// ====================================================

function releaseBallFromOuterTrack(
    radialX,
    radialZ,
    tangentX,
    tangentZ
) {

    ballPhase =
        "RELEASE_GUIDE";


    releaseGuideElapsed =
        0;


    releaseGuideStartSpeed =
        guidedSpeed;


    const position =
        ballBody.translation();


    releaseGuidePreviousPosition = {
        x: position.x,
        y: position.y,
        z: position.z
    };


    // IMPORTANT:
    //
    // We deliberately DO NOT change the velocity here.
    //
    // The OUTER phase has already set the ball's
    // current velocity to exactly the tangent velocity
    // it should have.
    //
    // This means there is no sudden inward kick and
    // therefore no visible jerk at the handoff.


    console.log(
        "Ball beginning smooth outer release.",
        "| revs:",
        guidedRevolutions.toFixed(2),
        "| speed:",
        guidedSpeed.toFixed(2)
    );
}

// ====================================================
// SMOOTH RELEASE GUIDE
//
// Carries the ball inward for a short period before
// giving complete control back to Rapier.
//
// Radius accelerates inward gradually:
//
//     radius change = t²
//
// Therefore:
//
//     at t = 0:
//         inward velocity = 0
//
// This is what prevents the release jerk.
// ====================================================

function updateSmoothReleaseGuide() {

    if (
        ballPhase !==
        "RELEASE_GUIDE"
    ) {

        return;
    }


    releaseGuideElapsed +=
        FIXED_TIME_STEP;


    const t =
        Math.min(
            releaseGuideElapsed /
                RELEASE_GUIDE_DURATION,
            1
        );


    // ------------------------------------------------
    // INWARD EASING
    //
    // t² means inward motion starts at zero and
    // smoothly increases.
    // ------------------------------------------------

    const radialBlend =
        t * t;


    const radius =
        OUTER_ORBIT_RADIUS +
        (
            RELEASE_GUIDE_END_RADIUS -
            OUTER_ORBIT_RADIUS
        ) *
        radialBlend;


    const speedBlend =
        t *
        t *
        t *
        (
            t *
            (
                t * 6 -
                15
            ) +
            10
        );


    const tangentSpeed =
        releaseGuideStartSpeed +
        (
            RELEASE_GUIDE_END_TANGENT_SPEED -
            releaseGuideStartSpeed
        ) *
        speedBlend;


    // ------------------------------------------------
    // KEEP REVOLVING WHILE MOVING INWARD
    // ------------------------------------------------

    guidedAngle +=
        (
            tangentSpeed /
            radius
        ) *
        FIXED_TIME_STEP;


    const cos =
        Math.cos(
            guidedAngle
        );


    const sin =
        Math.sin(
            guidedAngle
        );


    const x =
        cos *
        radius;


    const z =
        sin *
        radius;


    // ------------------------------------------------
    // HEIGHT
    //
    // While we're still over the physical bowl,
    // stay exactly on its surface.
    //
    // Once we pass the inner edge of the bowl at
    // radius 3.25, smoothly descend toward the rotor.
    // ------------------------------------------------

    const INNER_BOWL_EDGE_RADIUS =
        bowlProfile[0].radius;


    const innerBowlEdgeY =
        getBowlHeightAtRadius(
            INNER_BOWL_EDGE_RADIUS
        ) +
        BALL_RADIUS;


    let y;


    if (
        radius >=
        INNER_BOWL_EDGE_RADIUS
    ) {

        y =
            getBowlHeightAtRadius(
                radius
            ) +
            BALL_RADIUS;

    } else {

        const dropProgress =
            Math.min(
                Math.max(
                    (
                        INNER_BOWL_EDGE_RADIUS -
                        radius
                    ) /
                    (
                        INNER_BOWL_EDGE_RADIUS -
                        RELEASE_GUIDE_END_RADIUS
                    ),
                    0
                ),
                1
            );


        // Smoothstep.
        const dropBlend =
            dropProgress *
            dropProgress *
            (
                3 -
                2 *
                dropProgress
            );


        y =
            innerBowlEdgeY +
            (
                RELEASE_GUIDE_END_Y -
                innerBowlEdgeY
            ) *
            dropBlend;
    }


    // ------------------------------------------------
    // CALCULATE VELOCITY FROM ACTUAL MOVEMENT
    //
    // This is important.
    //
    // Rather than guessing what the release velocity
    // should be, calculate it from the distance the
    // ball actually travelled during this physics
    // frame.
    //
    // Therefore the velocity Rapier receives matches
    // the visible motion of the ball.
    // ------------------------------------------------

    let velocityX =
        0;


    let velocityY =
        0;


    let velocityZ =
        0;


    if (
        releaseGuidePreviousPosition
    ) {

        velocityX =
            (
                x -
                releaseGuidePreviousPosition.x
            ) /
            FIXED_TIME_STEP;


        velocityY =
            (
                y -
                releaseGuidePreviousPosition.y
            ) /
            FIXED_TIME_STEP;


        velocityZ =
            (
                z -
                releaseGuidePreviousPosition.z
            ) /
            FIXED_TIME_STEP;
    }


    // ------------------------------------------------
    // FORCE EXACT GUIDE POSITION
    // ------------------------------------------------

    ballBody.setTranslation(
        {
            x,
            y,
            z
        },
        true
    );


    // ------------------------------------------------
    // GIVE RAPIER THE VELOCITY THAT CORRESPONDS TO
    // THAT MOVEMENT
    // ------------------------------------------------

    ballBody.setLinvel(
        {
            x:
                velocityX,

            y:
                velocityY,

            z:
                velocityZ
        },
        true
    );


    // ------------------------------------------------
    // BALL SPIN
    // ------------------------------------------------

    const spinSpeed =
        tangentSpeed /
        BALL_RADIUS;


    ballBody.setAngvel(
        {
            x:
                cos *
                spinSpeed,

            y:
                0,

            z:
                sin *
                spinSpeed
        },
        true
    );


    // Save current position for next frame's velocity
    // calculation.
    releaseGuidePreviousPosition = {
        x,
        y,
        z
    };


    // ------------------------------------------------
    // FINISHED
    //
    // The ball is now over the numbered rotor.
    //
    // STOP guiding it completely.
    //
    // From the next physics step onward, Rapier gets
    // total control.
    // ------------------------------------------------

    if (
        t >= 1
    ) {

        ballPhase =
            "FREE_BOWL";


        releaseGuidePreviousPosition =
            null;


        ballBody.setLinearDamping(
            FREE_BOWL_LINEAR_DAMPING
        );


        ballBody.setAngularDamping(
            BALL_ANGULAR_DAMPING
        );


        const velocity =
            ballBody.linvel();


        const finalSpeed =
            Math.sqrt(
                velocity.x *
                    velocity.x +
                velocity.y *
                    velocity.y +
                velocity.z *
                    velocity.z
            );


        console.log(
            "Ball handed completely to Rapier.",
            "| radius:",
            radius.toFixed(2),
            "| speed:",
            finalSpeed.toFixed(2),
            "| y:",
            y.toFixed(2)
        );
    }
}


// ====================================================
// CHECK FREE-BOWL -> POCKET TRANSITION
// ====================================================

function updateBallPhase() {

    if (
        ballPhase !==
        "FREE_BOWL"
    ) {

        return;
    }


    const position =
        ballBody.translation();


    const radius =
        Math.sqrt(
            position.x *
                position.x +
            position.z *
                position.z
        );

        
    // ------------------------------------------------
    // Once the center of the ball gets this far in,
    // we're effectively entering the numbered rotor.
    //
    // The divider tips are at radius 3.08.
    //
    // Because the ball itself has radius 0.14,
    // contact can begin before its CENTER reaches 3.08.
    // ------------------------------------------------

    if (
        radius <=
        3.18
    ) {

        ballPhase =
            "POCKETS";


        // Restore the damping that gave us the pocket
        // behavior we already liked.
        //
        // Therefore changing the FREE_BOWL damping doesn't
        // also completely change how the ball dribbles
        // between the dividers and settles.
        ballBody.setLinearDamping(
            POCKET_LINEAR_DAMPING
        );


        ballBody.setAngularDamping(
            BALL_ANGULAR_DAMPING
        );


        console.log(
            "Ball entered pocket-divider area.",
            "| radius:",
            radius.toFixed(2)
        );
    }
}

// ====================================================
// DEBUG
// ====================================================

let debugTimer = 0;


// ====================================================
// DEBUG OUTPUT
// ====================================================

function updateDebug(
    delta
) {

    debugTimer +=
        delta;


    if (
        debugTimer <
        0.20
    ) {

        return;
    }


    debugTimer = 0;


    const position =
        ballBody.translation();


    const velocity =
        ballBody.linvel();


    const radius =
        Math.sqrt(
            position.x *
                position.x +
            position.z *
                position.z
        );


    const speed =
        Math.sqrt(
            velocity.x *
                velocity.x +
            velocity.y *
                velocity.y +
            velocity.z *
                velocity.z
        );
    
    // Radial velocity.
    //
    // Negative = moving toward center.
    // Positive = moving toward outside wall.
    const radialSpeed =
        (
            position.x *
                velocity.x +
            position.z *
                velocity.z
        ) /
        radius;

    // Tangential/orbital speed.
    //
    // This is MUCH closer to the speed your eye perceives
    // as the ball moving around the roulette wheel.
    //
    // Total speed can remain fairly steady even while
    // tangential speed suddenly drops because energy is
    // being redirected into radial/uphill motion.
    const tangentSpeed =
        (
            -position.z *
                velocity.x +
            position.x *
                velocity.z
        ) /
        radius;

    console.log(
        `Ball | ` +
        `phase: ${ballPhase} | ` +
        `revs: ${guidedRevolutions.toFixed(2)} | ` +
        `radius: ${radius.toFixed(2)} | ` +
        `height: ${position.y.toFixed(2)} | ` +
        `speed: ${speed.toFixed(2)} | ` +
        `tangent: ${tangentSpeed.toFixed(2)} | ` +
        `radial: ${radialSpeed.toFixed(2)}`
    );
}


// ====================================================
// ANIMATION
// ====================================================

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


    // ------------------------------------------------
    // FIXED PHYSICS LOOP
    // ------------------------------------------------

    while (
        physicsAccumulator >=
        FIXED_TIME_STEP
    ) {

        // Let Rapier simulate normally.
        physicsWorld.step();


        // During OUTER phase, overwrite tiny physics
        // errors with our exact guided circular orbit.
        //
        // The instant the ball releases, this function
        // stops modifying it.
        updateGuidedOuterOrbit();

        updateSmoothReleaseGuide();

        updateBallPhase();


        physicsAccumulator -=
            FIXED_TIME_STEP;
    }


    // ------------------------------------------------
    // SYNC THREE.JS BALL
    // ------------------------------------------------

    const position =
        ballBody.translation();


    ball.position.set(
        position.x,
        position.y,
        position.z
    );


    const rotation =
        ballBody.rotation();


    ball.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
    );


    // ------------------------------------------------
    // DEBUG
    // ------------------------------------------------

    updateDebug(
        frameTime
    );


    // ------------------------------------------------
    // RENDER
    // ------------------------------------------------

    renderer.render(
        scene,
        camera
    );
}


requestAnimationFrame(
    animate
);


// ====================================================
// RESIZE
// ====================================================

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