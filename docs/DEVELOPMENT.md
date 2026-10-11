# Development status

**Work in progress; active development resumed on October 11, 2026.**
The application builds with a current toolchain and can open its existing Ember
interface without game assets. This is a development build, not a playable release
or proof of complete campaign compatibility.

## Toolchain and commands

- Node.js 24 LTS, version 24.11.0 or newer; npm 11 or newer.
- Electron 44.7.0; Ember CLI / Ember 7.3.0; PixiJS 8.22.0.
- Vite 8.3.4 with Embroider; AGate Flow types are stripped at build time and
  bundled with esbuild. Runtime Babel registration and electron-compile are gone.
- The root npm workspaces link AGate and asset-converter to their current source.
  Commit the root lockfile when changing dependency versions.

```sh
npm ci
npm test
npm run test:ui
npm run build
npm run smoke
npm run smoke:renderer
npm run start:built
```

Electron 44 downloads its platform binary on first use. An internet connection is
needed for that first download as well as the initial npm install. On Linux, use
a desktop session with the libraries Electron requires. For headless CI, run
`xvfb-run -a npm run smoke`; do not add the global `--no-sandbox` flag.

`npm start` rebuilds before opening the desktop application. `npm run start:built`
uses existing build output. Append `-- --devtools` to inspect the renderer.
`npm run build:engine` rebuilds only AGate; `npm run build:ui` rebuilds only Ember.
`npm run smoke -- --smoke-report=/absolute/path/report.json` writes a startup
report. Smoke success requires the actual Ember readiness marker and no renderer
exceptions, crashes or timeout; the normal missing-data state is supported.

`npm run test:ui` builds the development UI and runs its QUnit suite inside
Electron. Rebuild normally afterwards for production output. The separate
`smoke:renderer` check creates synthetic graphics and checks actual WebGL pixels,
atlas metadata and custom filter behavior; it does not require game assets.

See [DEPENDENCIES](DEPENDENCIES.md) for version choices and audit limitations.
The converter has its own legacy `lib/start.js` entry point; its executor still
needs a documented configurable input/output workflow. The unit tests use
synthetic owned fixtures and do not convert or distribute retail data.

## Build validation performed

On October 11, 2026, a clean `npm ci` and the complete `npm run check` passed
on Linux with Node 24.14.1 and npm 11.11.0:

- 12 Node tests covering engine, converter and resource protocol behavior.
- 9 Electron/QUnit UI tests with 33 assertions, including controls and local GUI
  model loading.
- Production engine/UI build and Electron 44.7.0 startup, with no renderer
  exceptions or failed resource requests. Missing game assets display their
  requirements without starting an incomplete world.
- PixiJS 8.22.0 WebGL 2 rendering with expected atlas/filter pixels and no GL
  errors, using synthetic fixtures on an Intel Mesa GPU.

The GitHub workflow runs the same checks on a headless Linux display. These
checks do not validate original game assets, full map startup or gameplay.

## Electron compatibility mode

AGate and the existing GUI share Node constructors and the renderer DOM. The
current shell therefore explicitly uses Node integration with context isolation
disabled and renderer `sandbox: false`. This renderer compatibility setting is
separate from the global Chromium sandbox flag. The preload supplies a
project-root `requireNode` and runtime config.
Web security stays enabled; external navigation, new windows and webviews are
blocked, and local protocols enforce filesystem containment. Screen recording
is limited to the application frame after a user gesture.

This compatibility mode is intended for local development. Before distributing
a supported application, move privileged filesystem/network operations behind
narrow IPC APIs and enable context isolation. Do not load untrusted content or
scripts into this Node-enabled renderer.

## Local data and optional integrations

Game data is not distributed. The partial converter package does not supply a
complete retail-installation-to-engine conversion pipeline. The runtime expects
the previously converted map, graphics, prototype and other data formats.
Document and validate these formats while restoring conversion.

`config.json` uses `./local-data` by default. Paths resolve against the project
directory independently of the process working directory. Override the data
location before launching; changing it requires a relaunch, without rebuilding:

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
- Regression tests cover the build migration, local GUI data, asset prerequisites,
  atlas metadata, cache behavior and converter text decoding. They do not establish
  gameplay or campaign correctness.
- Electron compatibility mode still needs a complete IPC boundary before a
  supported end-user distribution.

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
- Static parsing/import inspection was performed on the first-party engine.
  A dormant invalid export and missing dormant imports remain in the recovered
  source. No application performance or campaign test was performed.
