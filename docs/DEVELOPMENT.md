# Development status

**Work in progress; active development resumed on October 11, 2026.**
This publication restores source and history. It does not establish a working
fresh install, a playable release or complete campaign compatibility.

## Preserved toolchain

The legacy manifests target Node 10, Electron 8.2, Ember CLI 3.19 / Ember 3.20,
PixiJS 5.3 and Babel/Flow. They contain old native and Git-hosted dependencies.
These versions describe the recovered project, not a supported production
environment. A reproducible current toolchain is the first development task.
The recovered root lockfile referenced removed prototypes and a malformed local
dependency URL, so it is not used at the current head. Generate and commit a new
lockfile when the supported dependency set has been recovered and validated.

Historical package workflow:

```sh
npm install
cd @openarcanum/agate
npm install
cd ../..
npm start
```

The local `file:` dependency must resolve the current AGate source. Check that
an installed copy has not become stale after editing the engine. No complete
installation or Electron launch has been validated for this public checkout.
The converter has its own package and legacy `lib/start.js` entry point; its
executor still needs a documented configurable input/output workflow.

## Local data and optional integrations

Game data is not distributed. The partial converter package does not supply a
complete retail-installation-to-engine conversion pipeline. The runtime expects
the previously converted map, graphics, prototype and other data formats.
Document and validate these formats while restoring conversion.

`config.json` uses `./local-data` by default. Paths resolve against the project
directory independently of the process working directory. Override the data
location before launching/building:

```sh
export OPENARCANUM_DATA_PATH=/absolute/path/to/locally-converted-data
```

Authored GUI definitions are loaded from `@openarcanum/asset-db/scripts`.
The historical extracted-item inventory demonstration has been removed;
inventory contents should come from game state.

The optional old YouTube integration has no built-in OAuth credentials.
`OPENARCANUM_GOOGLE_CLIENT_ID` and `OPENARCANUM_GOOGLE_CLIENT_SECRET` can be
provided through the environment when deliberately working on that integration.
It remains unvalidated. `.env.example` is a reference file and is not
automatically loaded. Do not commit credentials or generated tokens.

Own FlatBuffers schemas remain under
`@openarcanum/agate/src/shared/entity/schemas`. `generate_flatbuffers.sh` uses a
`flatc` executable on PATH; the appropriate compiler version still needs to be
recorded. The full historical FlatBuffers checkout/build is not distributed.

## Known implementation boundaries

- Server/player/world wiring is unfinished; several handlers use undeclared
  identifiers, world creation does not load a starting map, and gameplay
  command dispatch is incomplete.
- Pathfinding and NPC movement actions exist. The combat demo applies fixed
  damage and NPC updates are restricted to test identifiers.
- Dialogue, original scripts, quests, inventory/equipment rules, magic,
  progression, followers, travel and persistent campaign state need implementation
  or substantial integration and validation.
- GUI windows and metadata are not proof of the corresponding gameplay system.
- Converter correctness needs real fixtures. AI numeric parsing currently drops
  minus signs, and `!!"0"` produces an incorrect true door-opening flag.
- Existing Ember component tests are mostly scaffolding. The converter still
  contains a placeholder failing test. No green gameplay test suite is claimed.
- Electron's main/preload/renderer boundary and dependency versions need
  modernization before distributing a supported application.

## First playable checkpoint

Concentrate on one offline crash-site sequence before extending networking:

1. Reproducible install/build and original map loading from local data.
2. Player movement, container pickup and equipment with actual state effects.
3. A Virgil conversation with a real condition, response effect and quest flag.
4. One encounter with specified hit, damage, fatigue and death rules.
5. Save/reload restoring player, inventory, quest, NPC and party state.
6. Travel to another map and back with the same consequences preserved.

Use the original game or CE to check specified behavior. Record deterministic
state assertions and known unsupported boundaries. Defer broader multiplayer,
physics and framework changes until this sequence works.

## Publication checks performed

- All 77 imported first-party commits were retained, including the converter's
  six unmerged GlobalConverter commits. Their dates and topology were preserved
  while identities and file content were sanitized.
- Authored history was grouped by Europe/Prague calendar dates for the changelog.
- Game assets, application bundles, dependency directories and the confirmed
  old OAuth credential were excluded from every published historical revision.
- Portable configuration was checked from a different working directory, with
  and without a data-path environment override. Shell syntax was checked for
  the schema-generation script.
- The old Ember CLI could report its version under Node 24, with an explicit
  unsupported-runtime warning. This was a limited probe on the original copied
  dependency tree, not a build of this checkout.
- Static parsing/import inspection was performed on the first-party engine.
  A dormant invalid export and missing dormant imports remain in the recovered
  source. No application performance or campaign test was performed.
