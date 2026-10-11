# Development status

**Work in progress; active development resumed on October 11, 2026.**
The application builds with a current toolchain and opens its Ember interface
without game assets. Compatible local converted data enables an offline Bates
Mansion Lev 2 scene with a controlled actor and animated click-to-walk movement.
This is a development checkpoint; campaign compatibility is incomplete.

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
npm run smoke:game -- --show # requires compatible local converted game data
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
On a runner without a supported GPU, use
`npm run smoke:renderer -- --software-rendering` to run that fixture with
Chromium's CPU-backed SwiftShader driver. This option affects only the synthetic
test process. The default check continues to exercise the available GPU.

See [DEPENDENCIES](DEPENDENCIES.md) for version choices and audit limitations.
The converter has its own legacy `lib/start.js` entry point; its executor still
needs a documented configurable input/output workflow. The unit tests use
synthetic owned fixtures and do not convert or distribute retail data.

## Build validation performed

On October 11, 2026, a clean `npm ci` and the complete `npm run check` passed
on Linux with Node 24.14.1 and npm 11.11.0:

- 28 Node tests covering engine, converter and resource protocol behavior.
- 13 Electron/QUnit UI tests with 53 assertions, including controls and local GUI
  model loading.
- Production engine/UI build and Electron 44.7.0 startup, with no renderer
  exceptions or failed resource requests. Missing game assets display their
  requirements without starting an incomplete world.
- PixiJS 8.22.0 WebGL 2 rendering with expected atlas/filter pixels and no GL
  errors, using synthetic fixtures on an Intel Mesa GPU.

The separate visible real-data `smoke:game` run also passed on October 11:

- Nine Bates Mansion sectors, 1,423 prototypes and all 386 supplied map records
  plus one controlled actor loaded; 957 non-BlackYall tiles were placed in the scene.
- The actor animated from `(92, 99)` through `(93, 99)` to `(94, 99)`, then a native
  mouse click on the actual floor sprite returned it to `(93, 99)`.
- Blocked terrain `(94, 103)`, a blocking wall `(90, 100)` and void `(64, 64)` were
  rejected without moving the actor. The supplied terrain bitmap was separately
  compared against its original SEC block mask.
- Twelve representative GUI backgrounds decoded, subsequent frames advanced,
  and the approximately eleven-second session had zero captured runtime errors
  or failed resource requests. Eight duplicate source-GUID warnings are expected.

These observations establish this local scene checkpoint only. They do not prove
all map traversal, original rules or campaign compatibility.

The GitHub workflow runs the same checks on Ubuntu 24.04 with a headless display
and uses the explicit SwiftShader mode for the graphics fixture. On runners
with Ubuntu's AppArmor user-namespace restriction, it loads a profile for the
exact Electron executable so Chromium can use its normal namespace sandbox.
The public workflow uses synthetic fixtures and does not require or distribute
retail data. The separate `smoke:game` command exercises a real local scene and
is deliberately excluded from CI and `npm run check`.

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

The supplied historical data under `my_projects/OpenArcanum/@openarcanum/asset-db`
can be copied into this checkout's ignored `local-data/` directory. Keep the
original project copy intact. The expected layout is:

```text
local-data/
  archives/Bates Mansion Lev 2.zip
  archives/Prototypes.zip
  archives/Gfx.zip
  archives/Gfx-tiles.zip
  archives/townmap.zip
  gui/gui-images.json
  gui/gui-images.css
  mes/                    # converted rule tables and GUI text
  gfx/                    # supplementary converted artwork
  shader/                 # historical shader files
  worldmap/               # historical map imagery
  movies/                 # optional historical movies
  16086.json              # converted development actor
```

The runtime reads compatible converted formats. The older C++ `#UNPACKED.zip`
contains original SEC/MOB/ART/etc. inputs and cannot be mounted as one of these
runtime archives. Only Bates Mansion Lev 2 has been exercised with this dataset;
town-map imagery does not supply additional playable maps.

Launch with `npm run start:built`, then choose **Start local map**. Click a clear
floor tile to walk; drag the map to pan and use the mouse wheel to zoom. The
development actor starts at `(92, 99)`. Movement currently uses a fixed one-second
tile duration, rather than verified original speed rules. The legacy GUI windows
are scaffolding; their presence does not imply working character or inventory
rules. NPC AI and the old fixed-damage combat demonstration are disabled in this
offline scene.

To run the local scene check and retain diagnostics privately:

```sh
npm run smoke:game -- --show \
  --game-smoke-report=local-data/test-results/game.json \
  --game-screenshot=local-data/test-results/game.png
```

The check starts the scene, awaits map/atlas/player readiness, walks a known clear
path, rejects blocked, wall and void targets, clicks a real floor tile through
Electron mouse input, and observes subsequent frames. It fails on renderer
exceptions, console errors, stopped updates or failed local resource requests.
Without `--show`, it omits native pointer verification. Keep reports, screenshots,
converted data and future saves under the ignored directory.

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

- Network server/player/world wiring is unfinished; several handlers use undeclared
  identifiers, world creation does not load a starting map, and gameplay
  command dispatch is incomplete.
- The offline client bypasses the unfinished server. It loads converted map and
  prototype data, preserves eight duplicate source GUID records under distinct
  runtime IDs, and supports controlled actor movement. Original movement fidelity
  and dynamic obstacle changes still need validation. Path searches use a bounded
  region and can miss routes requiring longer detours. Eight explicit duplicate-ID
  warnings document the supplied dataset rather than silently dropping records.
- The historical renderer omits tiles categorized as `BlackYall`. Their traversal
  and transition semantics need original-game verification; the short smoke-test
  path does not establish collision correctness across the whole map.
- The supplied converted roof grid contains null rows despite roof references in
  the original SEC. Roof conversion/rendering, occlusion and lighting are unfinished.
- Historical NPC movement and combat scaffolding remains in source but is disabled
  in this scene; it does not implement original AI or combat rules.
- Dialogue, original scripts, quests, inventory/equipment rules, magic,
  progression, followers, travel and persistent campaign state need implementation
  or substantial integration and validation.
- GUI windows and metadata are not proof of the corresponding gameplay system.
- Converter correctness needs real fixtures. AI numeric parsing currently drops
  minus signs, and `!!"0"` produces an incorrect true door-opening flag.
- Regression tests cover startup, movement state, blocking, sprite atlas changes,
  local GUI data, asset prerequisites, cache behavior and converter text decoding.
  The real-data scene check is a narrow smoke test, not campaign validation.
- Electron compatibility mode still needs a complete IPC boundary before a
  supported end-user distribution.
- Stopping cancels scene updates and pending movement. Full Pixi resource and
  event-listener disposal across repeated route changes still needs work.

## First playable checkpoint

The current offline Bates Mansion scene establishes map loading and basic movement.
Next, work toward one complete sequence before extending networking:

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
- Game assets, application bundles and dependency directories were excluded from
  every published historical revision. The old OAuth credential and a subsequently
  discovered commented login block were removed from reachable published history.
- Portable configuration was checked from a different working directory, with
  and without a data-path environment override. Shell syntax was checked for
  the schema-generation script.
- Static parsing/import inspection was performed on the first-party engine.
  A dormant invalid export and missing dormant imports remain in the recovered
  source. No complete campaign or performance benchmark was performed.
