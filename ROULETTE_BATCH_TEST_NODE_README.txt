ROULETTE BATCH TEST - NODE .JS VERSION
======================================

This version is intended for your existing workflow, where you run files like:

    node src/twitchBot.js

SETUP

1. From your project root, install Rapier once:

    npm install @dimforge/rapier3d-compat

2. Replace the OLD browser-oriented file with this one:

    src/roulette_batch_test.js

3. Run 1,000 spins:

    node src/roulette_batch_test.js 1000

4. Run 10,000 spins:

    node src/roulette_batch_test.js 10000


IMPORTANT

If the first line of your current roulette_batch_test.js says:

    import RAPIER from "/vendor/rapier.mjs";

that is the wrong/browser version.

This replacement uses Node-compatible loading and does not require:
- "type": "module" in package.json
- a .mjs extension
- /vendor/rapier.mjs


OUTPUT

The script creates a simulation-results folder containing:
- a CSV with every spin
- a JSON summary

It also prints the statistical summary in the terminal.
