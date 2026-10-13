# Development status

**Work in progress; active development resumed on October 11, 2026.**
The application builds with a current toolchain and runs the bundled inventory
workshop without original game assets. Compatible local converted data enables a Bates Mansion
Lev 2 scene with an owned local headless server, one controlled actor, animated
click-to-walk movement, approach/use for a subset of doors and a local
position/door/verified-ownership checkpoint slot.
This is a development checkpoint; campaign compatibility is incomplete.

The [game pitch](GAME_PITCH.md) and [feature roadmap](FEATURE_ROADMAP.md) define
the renewed architecture: a headless authoritative server, the same client and
protocol for local singleplayer and co-op, versioned mods and multiplatform
delivery. The first local authority foundation now owns movement and door state on the server;
the rest of the campaign simulation remains unfinished. The
[reference-game oracle](ORACLE.md) documents private Wine/Ghidra tools, captures,
manual conversion and comparison scenarios.

## Editable game scripting

The [scripting workflow](SCRIPTING.md) describes TS7 imports, non-overwriting reimports,
scoped state, server/client modules and schema 7 / protocol 2 integration. The
owned workshop includes an executable scripted door; the local original profile
enables the verified Bates guard heartbeat. Full campaign and DLG execution remain open.

The October 14 scripting delivery passes **635 Node tests**, **87 native UI tests /
755 assertions**, and the TS7 production build across 459 authored source/declaration
files plus all 2,399 private converted scripts. Native Bates and owned Workshop
checks verify script effects, private presentation, idle callbacks and checkpoint
restoration. Full gameplay/lifecycle regressions also pass, including child-process
reaping and stale-session rejection. Reports are private under
`local-data/test-results/2026-10-14-scripts/`. Original arithmetic evidence comes
from static Ghidra inspection; corresponding reference-game input cases remain open.

## TypeScript

The compiler is pinned to **TypeScript 7.0.2**, the stable native compiler from
[Microsoft's TypeScript 7 release](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
All project-owned JavaScript in the engine, application, desktop, converter,
authored GUI, recovery tools, build/launch tooling and tests has been migrated to
`.ts`, `.cts` or `.mts`. Run
`npm run typecheck` for the source inventory and compiler checks. CI and
`npm run build` run these checks before bundling; an error stops the build.

| Configuration | Checked source and output |
| --- | --- |
| `tsconfig.engine.json` | Complete AGate client, authority, ECS, physics, serialization and legacy adapters; esbuild produces the client and headless authority bundles. |
| `tsconfig.app.json` | Ember application, components, routes, helpers, services and UI tests; Babel retains Ember's legacy decorator semantics while removing TypeScript syntax for Vite. |
| `tsconfig.electron.json` | Desktop host, preload, local child/session lifecycle and protocol handling; emits `.cjs` files and source maps into ignored `dist-electron/`. |
| `tsconfig.converter.json` | Asset converter; emits `.cjs` files into its ignored `dist/` directory. |
| `tsconfig.gui.json` | Authored GUI definitions and callback contracts; emits `.cjs` files and maps into ignored `@openarcanum/asset-db/compiled-scripts/`. |
| `tsconfig.config.json`, `tsconfig.tooling.json` | Configuration sources, root build entry and native Node 24 build/launch scripts. |
| `tsconfig.research.json`, `tsconfig.fixture-tools.json` | Original-data recovery tools and the deterministic owned Workshop generator. |

Production configurations use `strict: true`. JSON, IPC and wire input is
represented as `unknown` until the relevant runtime boundary validates it;
structural contracts describe entities, components and renderer interfaces.
Type-only class fields use `declare` where emitting a field would shadow an
existing getter or change initialization.

The root `tsconfig.json` selects the UI configuration for editors; the engine
and desktop directories have their own `tsconfig.json` discovery files. The npm
commands explicitly select their configurations. `skipLibCheck` skips dependency
**declaration** checking. The source inventory check rejects project-owned
JavaScript, `ts-nocheck` and `ts-ignore`; compiler configurations do not enable
`allowJs` or `checkJs`. Upstream PSON, generated FlatBuffers code and vendored
libraries retain their original formats and notices.
The reference oracle's shell/Python tools, templates, styles and data formats
remain in their existing languages.

Historical adversarial Node fixtures deliberately pass malformed data and use
a separate relaxed test configuration. Browser rendering fixtures retain strict
checking in `tsconfig.browser-fixtures.json`. `npm run typecheck:tests` first
emits engine declarations with the strict production configuration into ignored
`@openarcanum/agate/dist-types/`, then checks fixture calls against those APIs.
This keeps test inference settings out of production checking. Runtime
assertions, real socket/process tests and native rendering checks still establish
behavior; a successful compiler run cannot establish gameplay completeness.

`npm run build:config` compiles `config/*.cts`, then generates ignored conventional
`config/*.js` files and `ember-cli-build.mjs` from `ember-cli-build.mts` for Ember's
configuration discovery. Edit the TypeScript sources, not those generated files.
The default authored-GUI script path points to `compiled-scripts/`, populated by
`npm run build:gui`. Node 24 runs the `.cts`/`.mts` launch and maintenance scripts
directly; the Electron host and authored GUI load their compiled `.cjs` output.

The former Flow annotations/configuration and repeated stripping plugins have
been removed. The migration preserved protocol 1, then-current checkpoint
schema 6 / rules v9 and authored GUI layout data. The later carrying slice uses
rules v10 as described below. Typing exposed latent dormant helpers, including raw DOM
cursor positioning, GUI asset descriptor loading, socket disconnect forwarding
and a nonstandard random-number call. Unsupported old renderer pipelines now
fail explicitly. The [legacy adapter notes](LEGACY_ADAPTERS.md) describe explicit
provider requirements; these corrections do not implement those services or add
campaign features.

The October 13 TypeScript migration checkpoint passed the production build and compiler
checks across 427 authored source/declaration files. The full real-socket Node
suite passes 526 tests; seven additional renderer-script syntax tests pass,
checking 125 embedded JavaScript snippets. Native UI testing passes 83 tests /
726 assertions, including authored root/child registration, model reuse and
listener payload forwarding. Test discovery now rejects an empty module set or
a run below the 83-test baseline.

Renderer pixel checks pass with no WebGL errors. Both the owned Workshop and
original-data Bates scenarios pass their native-input gameplay and local-server
lifecycle checks with no application errors or failed requests. Reload, stale
session cleanup and child-process reaping are verified. Geometry comparisons
also match the previous implementation in 1,432 cases. These checks cover the
documented development scenarios, rather than campaign compatibility.
Private reports and captures are under ignored
`local-data/test-results/2026-10-13-typescript7-all/`. Existing build, Electron CSP
and platform warnings remain. The earlier limited migration's 506 Node / 82 UI
baseline is retained under `local-data/test-results/2026-10-13-typescript7/`.

## Authoritative carrying capacity

The owned neutral-human actor now uses Strength-based carrying capacity for
Take, Take All and Pickup. Its private inventory shows whole-item stone weights,
total/capacity and the seven reviewed encumbrance bands. A separate crate at
`(11, 2)` contains 4,000-stone Workshop ballast: exactly the empty ST8 limit.
One more stone rejects atomically; buying ST9 raises the limit to 4,500. Put and
Drop release capacity. Invalid/mutated weight metadata fails closed; unsupported
original profiles retain unknown capacity.

Checkpoint schema 6 now uses `movement-doors-ownership-attributes-weight-v10`.
Totals are derived from immutable item metadata and reciprocal ownership. Loads
validate the saved ownership against the saved/replayed Strength before any
world or character writes. Old-rule saves are incompatible. Native and socket
checks cover exact-capacity, overweight batch rejection, purchase rollback,
private observer boundaries and saved/live Strength differences.

The completed slice passes **557 Node tests**, **86 native UI tests / 746
assertions**, all TS7 compiler checks and the production build. The native
Workshop verifies exact 4,000-stone acceptance, overweight rejection, ST9's
4,500 capacity, Put/Drop/Pickup and restoration of the pristine saved build and
ownership. Both Workshop and Bates gameplay/lifecycle checks report zero
application errors or failed requests; all recorded owned server processes are
reaped. The owned fixture's 95 files and manifest match its deterministic
generator. Private evidence is under
`local-data/test-results/2026-10-13-carrying/`.

[Carrying capacity](WEIGHT.md) documents the supported subset and local evidence.
The movement clock, encumbrance speed/fatigue effects, stacks, equipment and
magical weight adjustments remain unfinished.

## Toolchain and commands

- Node.js 24 LTS, version 24.11.0 or newer; npm 11 or newer.
- Electron 44.7.0; Ember CLI / Ember 7.3.0; PixiJS 8.22.0.
- TypeScript 7.0.2 native compiler, with strict production checks across owned source.
- Vite 8.3.4 with Embroider and Babel for UI; esbuild for the AGate client and
  authority bundles. Runtime Babel registration and electron-compile are gone.
- The root npm workspaces link AGate and asset-converter to their current source.
  Commit the root lockfile when changing dependency versions.

```sh
npm ci
npm run typecheck
npm test
npm run test:ui
npm run build
npm run smoke
npm run smoke:renderer
npm run smoke:game -- --show # requires compatible local converted game data
npm run smoke:workshop -- --show --game-lifecycle # uses only bundled owned assets
npm run start:workshop
npm run start:built
```

Electron 44 downloads its platform binary on first use. An internet connection is
needed for that first download as well as the initial npm install. On Linux, use
a desktop session with the libraries Electron requires. For headless CI, run
`xvfb-run -a npm run smoke`; do not add the global `--no-sandbox` flag.

`npm start` rebuilds before opening the desktop application. `npm run start:built`
uses existing build output. Append `-- --devtools` to inspect the renderer.
`npm run build:engine` rebuilds the AGate client and headless authority bundles;
`npm run build:ui` prepares configuration and rebuilds Ember.
`npm run build:desktop` checks and emits the Electron host into ignored
`dist-electron/`. `npm run build:converter` and `npm run build:gui` emit the converter
and authored widgets. A full build runs all compiler and source inventory checks
first. `npm test` prepares configuration, desktop, converter and GUI output before
running its Node fixtures.
`npm run smoke -- --smoke-report=/absolute/path/report.json` writes a startup
report. Smoke success requires the actual Ember readiness marker and no renderer
exceptions, crashes or timeout; the normal missing-data state is supported.

`npm run test:ui` builds AGate and the development UI, then runs its QUnit suite inside
Electron. Rebuild normally afterwards for production output. The separate
`smoke:renderer` check creates synthetic graphics and checks actual WebGL pixels,
atlas metadata and custom filter behavior; it does not require game assets.
On a runner without a supported GPU, use
`npm run smoke:renderer -- --software-rendering` to run that fixture with
Chromium's CPU-backed SwiftShader driver. This option affects only the synthetic
test process. The default check continues to exercise the available GPU.

See [DEPENDENCIES](DEPENDENCIES.md) for version choices and audit limitations.
The converter's source entry is `@openarcanum/asset-converter/lib/start.cts`;
`npm run build:converter` emits `dist/start.cjs` inside that workspace. Its executor
still needs a documented configurable input/output workflow. The unit tests use
synthetic owned fixtures and do not convert or distribute retail data.

## Owned inventory workshop

`npm run start:workshop` builds and launches the owned example. Equivalently,
select `OPENARCANUM_MODULE=inventory-workshop` with the normal launcher. This
explicit module selects fixed bundled paths and ignores `OPENARCANUM_DATA_PATH`;
unknown module names reject. Normal startup still selects Bates Mansion.

The [example](../examples/inventory-workshop/README.md) contains one sector with
120 floor tiles, an actor starting at `(4, 4)`, an accessible container at
`(6, 4)` and a door at `(8, 4)`. The actor has an explicitly empty inventory.
The container's uniquely identified token occupies sparse ownership slot `3`,
independently of its item UI location `7`. Inspection returns the token privately
after a server-chosen approach; observers receive no item list or parent links.
Choose **Take** after inspecting to move the whole token into the actor's lowest
unused ownership slot, `0`. Its stable item identity and `Item.invLocation: 7`
are preserved. Both private lists update only after server confirmation.
Choose **Put** on that inventory row while the container is freshly inspected to
return the token to its lowest unused slot, now `0`. It can be taken again without
changing its identity or UI location. A verified attainable, currently accessible
known container can also receive a supported Generic item from another container
or the actor's original inventory.
**Take All** requests the entire inspected container in one server transaction.
Every item must satisfy the supported whole-item policy; an unsupported item, full
destination or failed write leaves all ownership unchanged. The server chooses
items in sparse source-slot order and fills the actor's lowest unused slots.
The original token loop contains one token; multi-item regression fixtures test
batch conservation, races and rollback. This does not establish original corpse
looting, equipment, stacking or complete original weight/effect rules. The
neutral actor now enforces the supported [carrying-capacity subset](WEIGHT.md). A second crate at `(3, 7)` holds a
standalone key for the declared supported locked door at `(10, 6)`. Take the key,
use and traverse that door, then put the key away. The open pose can be saved and
restored without the key being held; closing succeeds, while opening again
requires possession. A third crate at `(6, 8)` holds the **Workshop keepsake**
behind the same key. Inspect, Take, Put and Take All recheck possession, while
preserving both the key and lock. Returning the key to its accessible crate
blocks further access to the keepsake crate. See [standalone keys](KEYS.md) for
the source-backed rules and the additional per-command authority policy.
Current checkpoints persist position, doors and verified ownership, so loading
an earlier empty-inventory save returns the token to container slot `3`; loading
a taken-item save restores it to the actor without duplicating it. Saving after
Put retains the new container slot `0`, rather than resetting it to original `3`.

Generate the readable JSON, PNG atlases, three ZIP catalogs and file manifest:

```sh
node examples/inventory-workshop/generate.cts
npm run build
npm run smoke:workshop -- --show --game-lifecycle
```

Generation uses Node built-ins and is deterministic. The owned sources and all
95 generated data files are redistributable under GPL-3.0-or-later. ZIP catalogs
support the current archive enumeration API; loose files supply readable data.
Regenerate after edits so both representations agree. The startup manifest
validates known metadata, safe relative filenames and required assets; it is
not a general mod loader or executable rules format.

`Map.json.startLocation` is an optional integer pair in runtime tile axes, checked
against map bounds. Explicit starts load sectors around that location. Legacy
maps keep their existing fallback. The controlled actor has stable source
identity `16086.json` on both replicas; identity alone never turns missing
inventory metadata into a known empty list. Sprite metadata can select
`imageExtension: "png"`; GIF remains the default. Workshop startup bypasses the
retail GUI assets/scripts and uses the existing native interaction panels.

The authored **Workshop pebble** at `(4, 7)` adds ground pickup and dropping.
Click its artwork or choose it in **Ground items**, then **Pick up selected item**.
A verified private row offers **Drop** only when the server supplies `canDrop`.
Drop chooses the actor tile; held/container contents remain private, while the
loose pebble has a public floor descriptor and committed sprite location.
See [Ground items](GROUND_ITEMS.md) for the Generic-only opt-in, placement and
original junk-pile/script/grid limitations.

The **Workshop guide** at `(9, 8)` adds a conditioned conversation. Click the
guide or select it in **Conversation**, then accept **A closer look**. Pick up
the loose pebble and talk again to show it. The reply appears only while the
actor actually holds that exact item; showing it preserves ownership. **Journal**
displays the active/completed entry. Completion grants 2,100 XP once, reaching
level 2 and banking a sixth Character Point. **Character** displays these private
balances. Save/load restores progression and quest status alongside supported
inventory and poses. See [Dialogue and quests](DIALOGUE_QUESTS.md) for
the finite authored schema and remaining original-script work.

The normal workshop checkpoint path is ignored
`local-data/saves/inventory-workshop.json`, separate from original-content saves
and the bundled example. Automated smoke checks use a temporary slot. The
workshop provides a reproducible inspection, whole-item transfer and ownership
persistence witness; it does not complete M0's import
pipeline, the original rules or the supported mod API.

## Attribute validation on October 13, 2026

The attribute update passed **506 Node tests**, **82 UI tests with 712 assertions**
and production build on Linux. Focused authority regressions passed 173
cases/subcases, including 26 new purchase/preview cases; focused client checks
passed 146, workshop/catalog/config checks passed 24, and combined attribute and
progression sockets passed nine (five new attribute cases). Focused counts
overlap the complete Node run.

The owned Workshop ran with a nonexistent retail-data path. Native Increase
buttons spent the five starting points. A one-purchase checkpoint restored only
Strength 9 and four available points after the other points had been spent.
The five-purchase active quest checkpoint and six-purchase completed checkpoint
then restored their corresponding budgets and attributes. Completing the guide
quest replenished one point, which native input spent on Charisma. A direct
unfunded purchase rejected with `INSUFFICIENT_POINTS`; no item or legacy stat
mutation occurred. The final level-2 neutral preview showed HP/fatigue 35/35,
carry 4,500 stone, damage 0, armor adjustment −1, speed 9, heal 3, poison recovery
9, reaction −3 and follower limit 2. Native preview expansion and visible bounds
were verified. The complete prior gameplay loops plus purchases took about 102
seconds before lifecycle checks.

That attribute-validation checkpoint used progression definition version 2,
checkpoint schema 6 and rules v9. Tests cover capped-stat rejection, all eight purchases, negative
integer truncation and extraordinary/clamp boundaries, stale/racing/replayed
commands, partial-write/page failures, reordered JSON object keys, invalid save
histories, both bank-overflow orderings and complete checkpoint rollback.
Original character data remains unsupported without explicit authored opt-in.

Private evidence is under `local-data/test-results/2026-10-13-attributes/`.
The Bates rendering, movement, door, container, checkpoint, pause and lifecycle
regression passed with progression unavailable for the imported actor. Both game
reports captured no application errors or failed requests; screenshots were
inspected and recorded server children were independently checked after exit.
Existing build, development CSP and Linux desktop/driver warnings remain.
The owned data and manifest still match all 89 generated files. Derived values
are previews; movement, combat, carried-weight enforcement, effects, races,
backgrounds, other point purchases and respec remain unfinished. See
[Attributes](ATTRIBUTES.md) for primary sources and exact supported rules.

## Progression validation on October 13, 2026

The progression update passed **465 Node tests**, **76 UI tests with 665
assertions** and production build on Linux. Focused authority regressions passed
147 cases/subcases, including 29 new progression cases; focused client checks
passed 137, workshop/catalog/config checks passed 23, and the new real-socket
progression suite passed four. Focused counts overlap the complete Node run.

The owned Workshop ran with a nonexistent retail-data path. Native Character
refresh displayed the authored 0 XP / level 1 / 5-point baseline. Declining or
accepting the guide's quest preserved it; showing the carried pebble completed
the quest and displayed 2,100 XP / level 2 / 6 points without changing item
ownership. Loading the earlier active checkpoint reset progression to the
baseline, and completing it again granted one reward in that restored timeline.
A completed checkpoint restored the same reward and ownership. Putting the
pebble away and reopening terminal dialogue did not grant more XP. The complete
prior Workshop loops and progression took about 102 seconds before lifecycle
checks; native post-reward refresh and journal expansion also passed.

The Bates rendering, movement, door, container, checkpoint, pause and lifecycle
regression passed, retaining unavailable progression and the original actor's
unknown inventory. Reports captured no application errors or failed requests.
Screenshots and ignored evidence are under
`local-data/test-results/2026-10-13-progression/`. Existing build, development CSP
and Linux driver/desktop warnings remain. UI test render waits were corrected
before the passing UI rerun. All 89 owned files and the manifest match their
generator. These results were recorded before the validated changes were committed.

That validation used schema 5 / rules v8. Character Point purchases, base/derived
statistics, auto-level schemes, combat/follower XP and original reward modifiers
remain unfinished. [Character progression](PROGRESSION.md) records the reviewed
thresholds/point rules and explicit development cap policy.

## Conversation and quest validation on October 12, 2026

The dialogue update passed **422 Node tests**, **70 UI tests with 614 assertions**
and production builds on Linux. Focused authority regressions passed 118 cases
and subcases, including 26 new conversation cases; focused client checks passed
128, source-only workshop/catalog/config checks passed 22, and the new real-socket
dialogue suite passed three. These focused counts overlap the complete Node run.

The owned Workshop ran with a nonexistent retail-data path. Native Talk/Accept/
Show/Goodbye controls and a click on the guide's artwork exercised approach,
private branching replies and the held-item condition. Declining left the journal
empty; showing the pebble completed the quest without changing inventory. Active
and completed saves restored quest status and item placement together. Putting
the pebble away left completion intact; reopening offered only goodbye. Native
journal expansion displayed the completed entry. The complete prior inventory,
key, ground, door and pause loops plus dialogue took about 102 seconds before
stop/reload/fresh-host lifecycle checks.

The separate Bates rendering, movement, door, read-only container, checkpoint,
pause and lifecycle regression passed. Original locks, NPCs and unknown actor
inventory retain their restrictions. Final reports captured no application errors
or failed requests; both screenshots were inspected. All 88 owned files and the
manifest remained byte-for-byte generated after gameplay. Existing build,
development CSP and Linux driver/desktop warnings remain in logs.

Private evidence is under `local-data/test-results/2026-10-12-dialogue-quests/`.
The first full run exposed malformed-ground fixtures that now conflicted with
the newly referenced quest item; isolating those fixtures from unrelated dialogue
rules restored their intended tests before the passing full rerun. Current saves
use schema 4 / rules v7; older saves are disposable. Original DLG/script execution,
stat checks, speech rules, rewards, timestamps and party conversations remain
unfinished. These results were recorded before the validated changes were committed.

## Ground-item validation on October 12, 2026

The ground update passed **382 Node tests**, **64 UI tests with 542 assertions**
and production build on Linux. Focused authority tests passed 92 cases/subcases;
client tests passed 118, and the new real-socket ground suite passed three. They
cover ownership conservation, explicit opt-in/art/metadata checks, placement
bounds, same-tile and portal rejection, permissions/replay/revision/pause/busy
guards, owner races, failed writes and atomic checkpoint rollback. Held and
container-owned items remain private; loose ground descriptors are public.
Late replies and asynchronous sprite loads cannot restore discarded ownership
or picked-up artwork. That ground-only validation used schema 3 / rules v6;
the later dialogue update used schema 4 / rules v7.

The visible workshop ran with a nonexistent retail-data path. Native **Pick up
selected item** approached and took the pebble at `(4, 7)`; native **Drop** placed
its artwork at the actor's `(4, 6)` tile. After walking away, a native click on
the dropped sprite approached and picked it up again. Loading restored the same
floor item without duplicating it in inventory. Native Put/Take through the token
crate preserved the token and pebble's Drop capability; a held checkpoint then
restored only private ownership after another Drop. The pebble was returned to
its original floor position before the existing token, key, locked-container,
door, pause and checkpoint loops. The complete scenario took about 69 seconds
before stop/reload/fresh-host lifecycle checks.

The separate visible Bates regression passed rendering, movement, door,
read-only container, checkpoint, pause and lifecycle checks. Original locks and
unknown actor inventory retain their restrictions. Final game/UI reports captured
no application errors or failed requests; all recorded authority children were
independently confirmed reaped. Screenshots were inspected, and all 68 owned data
files remained byte-for-byte generated after gameplay. Existing build and Linux
desktop/driver warnings remain in logs. Private QA evidence is under
`local-data/test-results/2026-10-12-ground-items/`; [Ground items](GROUND_ITEMS.md)
records primary-source behavior and the narrower development policies. The first
full test run exposed an outdated schema-mismatch fixture, corrected before the
passing full rerun. These results were recorded before the validated changes were committed.

## Locked-container validation on October 12, 2026

The container-key update passed **349 Node tests**, **60 UI tests with 496
assertions** and production build on Linux. Focused authority coverage passed
71 cases/subcases, and the real-socket inventory suite passed 21. Coverage includes
held-key access before approach, on arrival, inspection and transfer commit;
private item conservation; immutable lock metadata; atomic failed writes;
multistep initial key chains; and rejection of self-locked keys and inaccessible
cycles. Putting the authorizing key inside the locked crate immediately loses
access but survives save/restart/load with valid reciprocal ownership. Current
checkpoints use schema 2 / rules v5, without older-save compatibility.

The visible owned workshop ran with a nonexistent retail-data path and passed
native locked-crate Inspect, Take, Put and Take All. Saving a taken keepsake,
returning it and loading restored the same item only to the actor; returning it
again preserved the crate's new slot `0`. Returning the key to its separate crate
blocked further locked-container access. The existing token and matching-door
loops, pause, checkpoint and stop/reload/fresh-host lifecycle checks also passed.
The scenario took about 53 seconds before lifecycle checks. An independent
observer matched actor, door and container state at recorded revisions and
received no private contents, names or key metadata.

The separate visible Bates regression passed movement, door, read-only container,
checkpoint, pause and lifecycle checks. Original imported locks and unknown actor
inventory retain their restrictions. Both game reports and the UI report captured
no application errors or failed requests; all recorded authority children were
reaped. Both screenshots were inspected, and all 63 owned data files remained
byte-for-byte generated after gameplay. Existing build and Linux desktop/driver
warnings remain in logs. Private QA evidence, including the corrected smoke
sequence's first stale-inspection rejection, is under
`local-data/test-results/2026-10-12-container-keys/`. Source-backed rules and their
development-policy limits are documented in [Keys](KEYS.md). Changes remain local
and uncommitted.

## Standalone key validation on October 12, 2026

The key update passed **329 Node tests**, **59 UI tests with 480 assertions** and
production build on Linux. Focused authority coverage passed 53 cases/subcases;
the real-socket inventory suite passed 20. They cover known reciprocal key
ownership, zero/master/equality rules, immutable key/component metadata, no-ring
restrictions, mixed-batch atomicity, authored script-review declarations,
arrival-time rechecks, occupied-door protection and atomic pose writes. A fresh
host restores an open locked door after the key is put away; another opening
still requires current possession. Current save rules are v4; compatibility
branches for previous development rules were removed.

The visible owned workshop ran with a nonexistent retail-data path. Native
inspection/Take/door Use/Put completed the key loop. The door blocked movement
before opening, permitted traversal with a carried key, retained its lock flag,
closed without the key and rejected reopening. Loading the saved open pose kept
exactly one nonconsumed key in its crate and retained the actor's original token.
Public observers received neither private key metadata nor item contents. The
scenario took about 50 seconds before successful stop/reload/restart lifecycle
checks. The separate visible Bates regression passed movement, doors, read-only
containers, checkpoints, pause and lifecycle. Both game reports and the UI report
captured no application errors or failed requests; all recorded authority children
were reaped, and all 60 owned data files remained byte-for-byte generated. Existing
build and Linux desktop/driver warnings remain in logs. Private QA evidence is under
`local-data/test-results/2026-10-12-keys/`; primary-source and original-record
evidence is under `local-data/research/keys/`.

## Private item-name validation on October 12, 2026

The item-name update passed **295 Node tests**, **56 UI tests with 447 assertions**
and production build on Linux. Catalog tests verify explicit row IDs, inherited
fields and instance overrides, identification gates, missing unknown text,
module/key fallbacks, ambiguity and size limits, and immutable independent hosts.
Headless and socket scenarios verify names in inspection/inventory/Take/Put/Take
All replies while ownership signatures, public snapshots and saves contain no
catalog text. Changing only the text table and restarting preserves both current
and compatible legacy content hashes and loads the same item without rewriting
the checkpoint. UI tests render HTML-like names as escaped text and preserve
their literal value in Put accessibility labels. Client tests cover the private
label boundary and discard oversized replies safely.

The visible workshop used a nonexistent retail-data path. Native inspection and
Take/Put/Take All preserved **Workshop token** through both private owner views
and save restoration; observers received no item names or contents. The scenario
took about 19 seconds before successful host lifecycle checks. The separate
visible Bates scene passed movement, doors, read-only containers, checkpoints,
pause and lifecycle. Both game reports and the UI report captured no application
errors or failed requests, all recorded authority children were reaped, and all
56 owned data files still matched deterministic generation. Existing upstream build and Linux
desktop/driver warnings remain in logs. Private QA evidence is under
`local-data/test-results/2026-10-12-item-display/`; source/prototype evidence is
under `local-data/research/item-display/`.

## Take All validation on October 12, 2026

The Take All update passed **284 Node tests**, **55 UI tests with 436 assertions**
and production build on Linux. Multi-item source fixtures verify sparse selection
order, occupied actor slots, exact item conservation, whole-set capacity and both
preflight and mid-commit failure on the second item's parent. Real sockets verify
a batch versus single-item race with one winner, mixed unsupported contents
leaving the entire source unchanged, public privacy, strict envelopes/guards and
fresh-host checkpoint restoration. Client checks reject partial or fabricated
successful batch replies, including conserved unsupported item types, and recover
after timeout without retrying the mutation.

The visible workshop used a nonexistent retail-data path and native Take All
input to retake its returned token. The empty container then rejected another
batch; loading the preceding checkpoint restored exactly one token in container
slot `0`. Owner and observer public state matched without private item IDs or
contents. The scenario took about 19 seconds before successful stop/reload/start
lifecycle checks. The separate visible Bates run passed movement, doors,
read-only containers, checkpoints, pause and lifecycle. All three reports
captured no application errors or failed requests, all recorded authority children
were reaped, and all 55 owned module assets remained byte-for-byte generated. Existing
upstream build and Linux desktop/driver warnings remain in logs. Private evidence
is under `local-data/test-results/2026-10-12-take-all/`.

## Take/Put validation on October 12, 2026

The Put update passed **266 Node tests**, **50 UI tests with 381 assertions** and
production build on Linux. Tests cover repeated same-item transfers, an item
originally held by the actor, another verified destination, untouched sparse
entries, full destinations and rollback when a write fails. Real sockets verify
private contents, competing Put requests with one winner, fresh-host restoration
of an actor inventory with a gap, and stale/replay/permission/pause/busy/lock/range
rejections. Compatible previous-rule saves pass an independently recomputed old
raw-content hash and strict old ownership rules, without rewriting the file.

The visible workshop ran with a nonexistent retail-data path and used native
Take, Put and re-take input. Returning the sole token allocated container slot
`0`; another Put rejected, taking it again retained its identity, and a saved
Put state restored an empty actor and one token in container slot `0`. Observer
snapshots contained no selected item IDs or private rows. The scenario took
about 19 seconds before lifecycle checks. The separate visible Bates run passed
movement, doors, read-only containers, checkpoints, pause and lifecycle. Both
game runs and the UI report captured zero application errors or failed requests,
all recorded authority children were reaped, and bundled assets stayed unchanged.
Existing upstream build and Linux desktop/driver warnings remain in logs.
Evidence is under
`local-data/test-results/2026-10-12-inventory-put/`.

## Inventory transfer validation on October 12, 2026

The transfer update passed **248 Node tests**, **45 UI tests with 322 assertions**
and production build on Linux. Coverage includes real owner/observer sockets,
competing owner requests with one winner, stale/replayed/unauthorized requests,
unknown actor inventory, checkpoint exclusivity, immutable item conservation,
prototype isolation, sparse-hole placement and rollback of failed loads/writes.
Fresh-host restoration preserves the same owned item identity.

The visible workshop run, with a nonexistent retail-data path, clicked **Take**
through native input and displayed one token in the private actor inventory.
Taking it again rejected. Loading an earlier checkpoint returned it to original
container slot `3`; taking, saving and loading restored it to actor slot `0`
without recreating it in the container. Observer snapshots carried no selected
item ID or private rows. The scenario took about 19 seconds before lifecycle
checks. Stop/reload/restart and the separate Bates regression passed, with zero
captured application errors or failed asset requests and all recorded children
reaped. Generated module assets remained unchanged. Existing upstream build and
Linux desktop/driver warnings remain in logs. Evidence is recorded under
`local-data/test-results/2026-10-12-inventory-transfer/`.

## Workshop validation on October 12, 2026

Validation passed **218 Node tests**, **38 UI tests with 269 assertions** and
the production build on Linux. The Node suite includes exact regeneration of
all 55 files, ZIP/readable-source parity, real PNG frame coverage, headless
nonempty inspection, checkpoint checks and off-center/invalid spawn cases.

The visible Electron workshop run used
`OPENARCANUM_DATA_PATH=/definitely/missing-retail-data` and successfully loaded
only its bundled module. It inspected the reciprocal token privately, matched
an observer without exposing contents, exercised native Inspect/Pause/floor
input, restored a checkpoint while paused, traversed the opened door and
restored its running baseline. Stop, reload and restart reaped all recorded
authority children. The scenario took about 15 seconds before lifecycle checks.
Generated assets remained byte-for-byte unchanged after gameplay.

The separate visible Bates run passed movement, door, checkpoint, container,
pause and lifecycle regressions. Both game reports and the UI report captured
zero application errors and zero failed requests. Existing upstream build and
Linux desktop/driver warnings remain in logs; these results do not establish
other platforms or original campaign completeness. Private evidence is under
`local-data/test-results/2026-10-12-workshop/`.

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

On October 12, the map rendering fixes were verified with 55 Node tests, the
same 13 UI tests/53 assertions, a production build, Electron startup and the
actual WebGL fixture. New pixel checks cover solid walls and doors, artwork
transparency, decoration depth and reordering during movement. The graphics
fixture also covers roof placement, mirroring, interior hiding, transparent
mouse hits, static light falloff/overlap, unlit emitters, foreground occlusion,
ground-sampled object tinting through movement and animation, camera transforms
and resize. The earlier graphics fixture passed with
SwiftShader; the latest combined roof/light fixture was verified on the Intel GPU.

The rebuilt real-data scene check rendered all 2,983 typed ground records across
nine sectors, including rug Facades and black boundary artwork. The actor walked
the same two-tile route, rejected all three blocked targets, and returned to
`(93, 99)` through a native mouse click on a rug. The approximately eleven-second
session captured no runtime errors or failed resource requests. Original SEC/ART
samples were used to verify coordinate conversion and floor/wall hotspots;
these observations still do not establish complete original visual fidelity.

With recovered roof/light metadata, the scene loaded all 72 roof pieces and four
static light masks without skipped records. Roof visibility was checked as
interior hidden, exterior-edge visible and interior hidden again; the exterior
edge is a format witness, not a claim that the tile is walkable. Movement and
native rug clicks still passed with no runtime errors or failed requests.
The ground-sampling pass registered 102 ordinary objects with cached tints,
leaving 250 filtered targets for floors and walls. The animated player retained
its expected ground color after both the scripted walk and native click, with
no floor light filter attached to its sprite.

The GitHub workflow runs the same checks on Ubuntu 24.04 with a headless display
and uses the explicit SwiftShader mode for the graphics fixture. On runners
with Ubuntu's AppArmor user-namespace restriction, it loads a profile for the
exact Electron executable so Chromium can use its normal namespace sandbox.
The public workflow uses synthetic fixtures and does not require or distribute
retail data. The separate `smoke:game` command exercises a real local scene and
is deliberately excluded from CI and `npm run check`.

The local authority foundation adds real Socket.IO tests with owned converted
fixtures. They cover authenticated owner/observer connections, protocol versions,
non-square map geometry, command validation, blocked/void/unreachable targets,
replayed IDs across reconnection, matching observer snapshots, autonomous
movement after owner disconnect, and clock/listener/ZIP cleanup. Failed startup
is exercised with a missing actor and a corrupt map archive. A separate real-data
headless check loaded Bates and advanced `(92, 99)` to `(93, 99)` in approximately
one second without a renderer. Child-process lifecycle checks and the extended
scene smoke cover the desktop-owned host. These checks establish the movement
foundation; they do not establish persistence, original timing rules or co-op.

The visible real-data authority scene run on October 12 rendered all 2,983 typed
ground records, 72 roof pieces and four static lights. While the client render
loop stayed at frame 5, the headless host completed the route from `(92, 99)` to
`(94, 99)`. A separately authenticated observer received 40 movement snapshots
and matching state, server time and revision, including revision 42 at completion.
A native floor click then returned the actor to `(93, 99)`. The run recorded zero
runtime errors or failed resource requests, and final teardown reported the host
stopped with no child PID. This directly exercises the independence of simulation
from rendering; it still covers only the supplied Bates checkpoint.

Final local-authority validation on October 12 passed **94 Node tests** and
**14 Electron/QUnit UI tests with 64 assertions**, a production client/server/UI
build, desktop startup with present and missing data, and the actual WebGL fixture
with no GL errors. Node 24.14.1/npm 11.11.0 built the project; Electron 44.7.0 ran
with its Node 24.21.0 runtime. The UI suite includes destruction during a pending
server start and verifies that no abandoned client is created.

The visible production `--game-lifecycle` run also passed. It replaced the running
scene's server, issued overlapping stop/start requests, reloaded the document and
verified that the previous PID was reaped with no restarted host. A fresh session
then accepted an owner connection; an old lease's stop request left it running.
Final stop disconnected that owner and reaped the fresh PID. The report contained
no captured application errors or failed resource requests, and final host state
was `stopped` with `pid: null`. Reports and the scene screenshot are kept privately
under `local-data/test-results/2026-10-12-authority/`.

The subsequent door-interaction validation on October 12 passed **115 Node tests**
and **18 Electron/QUnit UI tests with 87 assertions**. The actual WebGL fixture
passed with no GL errors. A visible production scene run selected the real Bates
door at `(98, 97)` through an opaque ART pixel and approached `(97, 97)` before
opening it. The committed open frame was `6`, with an actual `11×101` texture;
closing selected frame `0`, with a `34×95` texture. Both sizes and hotspots were
checked against the original local ART and converted metadata. The actor crossed
the open doorway; closing while it occupied `(98, 97)` returned `OCCUPIED` without
changing door state. The check restored the closed door and actor `(93, 99)`.
An independent observer matched the owner actor, door, revision and server time
after each successful use. The same run passed the session/reload checks, captured
no application errors or failed requests, and ended with the host stopped and no
child PID. Evidence is kept privately under
`local-data/test-results/2026-10-12-doors/`. This is one verified door scenario,
not validation of all doors or original interaction rules.

The subsequent local-checkpoint validation on October 12 passed **140 Node
tests** and **22 UI tests with 117 assertions**. Tests cover owner-only commands,
replay/busy rejection, invalid/incompatible files, candidate collision, failed
write preservation, stopped-host IO, fresh-host restoration, relocated identical
data and client acknowledgement/snapshot ordering and cancellation. Production
build, startup smoke and the WebGL fixture passed.

The visible Bates run saved the actor at `(97, 97)` with the door at `(98, 97)`
open, changed to actor `(93, 99)` with the door closed, then restored the saved
state. The original frame `6` texture `(11 × 101)` and cleared door collision
returned; the observer matched the committed state exactly. The run restored
the closed door and actor `(93, 99)`, activating **Save checkpoint** through real
Electron mouse input to retain that baseline. The checkpoint scenario took
about 12 seconds. The subsequent session/reload lifecycle check passed and
reaped every recorded child PID. No captured application errors or failed
resource requests occurred. Evidence remains private under
`local-data/test-results/2026-10-12-checkpoint/`.

Vite chunk-size and existing vendor warnings, Electron's development CSP warning,
the Vulkan driver warning and a desktop MIME-cache stderr warning remain. These
checks establish the narrow position/door checkpoint and tested Linux session;
they do not validate campaign saves or other platforms.

The subsequent container-inspection validation on October 12 passed **189 Node
tests** and **26 UI tests with 150 assertions**, plus the production build and
visible Bates scene/session lifecycle checks. The recovery tool parsed all 53
original MOBs and 19 referenced prototypes to exact EOF, checked reciprocal
ownership for 32 items and preserved unrelated instance fields. The reviewed
instance overlays were installed only in ignored local storage.

The real container scenario took about 40 seconds: the server approached the
unlocked dresser at `(78, 86)`, sent its empty inventory privately, rejected the
locked chest at `(98, 94)` and accepted native **Inspect container** input.
An independent observer matched public state without receiving contents or
counts. Walking cleared the inspected view; existing door/checkpoint scenarios
also passed. No captured application errors or failed resource requests occurred,
and every recorded host PID was reaped. Evidence remains private under
`local-data/test-results/2026-10-12-containers/`. Existing development/driver
warnings remain as described above. This validates read-only inspection, not
item transfer, keys, equipment, inventory persistence or other platforms.

The subsequent local-pause validation on October 12 passed **206 Node tests**
and **32 UI tests with 196 assertions**, the production build and visible Bates
scene/session lifecycle checks. The real native-input scenario froze movement
at `201.576 ms` of a `1000 ms` tile step for more than `1250 ms` of wall time.
Host revision/progress, world-space and projected sprite position, animation
frame and client world-step count stayed unchanged while render frames continued.
The observer matched, new movement rejected `PAUSED`, and native Resume completed
the original movement command. Idle save/load remained paused until Resume.
The pause scenario took about 3.5 seconds and restored the running baseline.
Door, checkpoint and container regressions also passed, with no captured
application errors or failed resource requests and every recorded host PID
reaped. Evidence remains private under
`local-data/test-results/2026-10-12-pause/`. Existing development/driver warnings
remain; this is Linux local-session evidence, not multiplayer or campaign parity.

## Local authority checkpoint

Normal desktop **Start local map** starts the built headless authority through
Electron's main process and connects the normal rendering client. The main process
owns the child PID, startup timeout, private random owner/observer credentials and
shutdown. The child binds only `127.0.0.1`, selecting an ephemeral port. Credentials
travel over its private IPC pipe rather than command-line arguments or logs.
Stopping the session or closing its owner shuts down the child; unexpected host
termination is a runtime error rather than a switch to client-side simulation.

Each desktop start request has its own session lease ID. The main-process session
controller checks that request and its generation before and after asynchronous
startup. Main-document navigation/reload, renderer loss and window/application
closure invalidate pending requests and stop the owned host; a request waiting for
an older child to exit cannot revive a session after invalidation. Cleanup from an
old component carries its old lease, so it cannot stop a newer component's session.
Component destruction also aborts pending client startup. The lease/controller
tests cover these races separately from the optional actual-reload smoke below.

The server uses shared converted map/prototype classes with the renderer and
experimental NPC/combat systems disabled. It indexes only the prototype and
selected map archives, honoring compatible loose-file overlays. It loads the
map and controlled actor independently of client-provided data. The current
checkpoint uses the server-defined Bates spawn `(92, 99)` and actor ID `0`.

The Socket.IO protocol is version **1**:

- Authenticate the connection with `{ version: 1, token }`, then send
  `authority:join` with `{ version: 1 }`. The acknowledgement identifies the role,
  map, controlled actor, next command ID and current snapshot.
- Send `authority:command` with
  `{ version: 1, id: 1, actorId: '0', type: 'move', target: [93, 99] }`.
  The host accepts only the owning role and an increasing positive integer ID.
  Geometry, location, speed and a proposed path are not accepted from the client.
- A door-use request has the same envelope with `type: 'use'` and
  `targetId: '<canonical converted entry path>'` instead of `target`. The server
  resolves the exact map entry, chooses an approach path and rechecks the target
  before committing its state. The client does not choose a door's position,
  lock state or resulting open state.
- The acknowledgement returns an accepted server path or an explicit rejection
  code and message. Valid owner command IDs are consumed even when the destination
  is rejected; a reconnect retains that session's ID high-water mark. Busy moves
  are rejected. A move to the current tile completes immediately.
- `authority:snapshot` sends revisioned actor state to joined owners and observers.
  Integer location is the last crossed tile. Active movement contains its command
  ID, server path, crossed waypoint index, elapsed time and fixed tile duration.
  The client interpolates sprite position between snapshots; its rendering clock
  cannot advance authoritative location. Completion is an explicit command state.
- Snapshots also include `doors`, with entry ID, location, open/locked/usable
  state, any unsupported reason and supported closed/open frame numbers. A
  completed use records `lastCommand.type: 'use'`, `targetId` and
  `result: { targetId, open }`; interrupted use records an error code/message.
- An observer sees the same state but cannot control the actor. Disconnecting the
  owner socket does not stop an active server move; stopping the owned host does.

The host's movement clock uses a fixed **1,000 ms per tile** independently of
renderer frames. This is a development policy, not verified original speed,
encumbrance, fatigue, turn-based movement or world-time behavior. One actor and
read-only observers do not constitute playable multiplayer.

### Local pause and resume

**Pause** and **Resume** in the **Local game** panel send owner-only version-1
intentions `{ version: 1, id, actorId: '0', type: 'pause' | 'resume' }`. The host
advertises `snapshot.pause = { supported, paused }`; configuration
`{ "allowPause": false }` disables both actions. The local desktop host enables
pause by default. Observers can see pause state but cannot control it.

Pausing commits movement through that monotonic instant, freezes fractional
progress and pending approaches, and leaves the active command's completion ID
intact. Resume excludes paused wall time from movement elapsed time. The client
freezes sprite position at the committed fraction and stops world animation
updates; rendering and interface input continue. New movement, door use and
container inspection reject `PAUSED`. Pause controls remain usable during an
approach, allowing it to resume and complete normally.

Save/load remains available while paused and idle; an unfinished movement still
rejects checkpoint actions as busy. Pause/resume is also blocked during
checkpoint IO. Pause is transient session policy, excluded from checkpoint v1:
loading while paused retains pause, and a fresh host begins running. It does
not change the existing save schema or content/rules identity. Acknowledgements
and snapshots are reconciled independently of movement completion; superseded
or missing confirmations reject recoverably rather than retaining a busy wait.

This implements the current local movement/interaction clock boundary. Original
calendar, NPC AI, combat, scripts, rest/time acceleration and multiplayer pause
consent are not established. The snapshot's `serverTime` remains a wall-clock
timestamp, not a saved campaign clock.

### Door interaction boundary

Click a supported door's artwork or choose it in the **Doors** panel and select
**Use selected door**. The UI reports approach, completion and rejection. The
server owns the door state and its collision change; the client displays the
committed original pose. A canonical converted entry path identifies the target,
so duplicate GUIDs cannot select another record. Opening does not mutate shared
prototype flags. A fresh host begins with imported state until an explicit
checkpoint load restores the saved position and doors.

Converted instance overlays preserve nested fields absent from the prototype and
explicit zero values, including initial door frames. A managed door's committed
open/closed state overrides an inherited `NoBlock` flag for collision, so closing
an initially open door restores blocking. Inactive objects and unmanaged portals
retain their existing flag policy; the original converted flags are not changed.

The implementation follows the original `NeverLocked` precedence over `Locked`
in [CE's lock check](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/object.c#L4024).
The original [portal logic](https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/portal.c#L93)
uses frame `0` for closed doors and endpoints `6` or `3` according to rotation.
The Bates smoke door's original seven-frame ART was checked directly. Presentation
currently switches to these endpoints; it does not play the opening/closing
sequence or reproduce original action timing and sounds.

Cardinal-neighbor approach and rejection of closing an occupied doorway are
explicit development policies, not verified original reach or obstruction rules.
Unreviewed locked doors reject use; authored key access is described below.
Lock picking remains unfinished. Timed locks
without `NeverLocked`, directional `AlwaysLocked`, jammed, magically held,
damaged, sticky or unrecognized portal flags are unsupported and report a reason.
Windows, traps and original scripts are not implemented by
this interaction path. Original flag/frame evidence does not establish complete
scripted-door compatibility.

### Container inspection and ownership

Run the [inventory recovery tool](INVENTORY_RECOVERY.md#run-and-install-locally)
to restore the original instance links before container inspection. The tool
uses original MOB/prototype records, preserves loose overlays and emits no
retail data into source control. Recovered sparse ownership-list indices are
independent of `Item.invLocation`; explicit empty arrays distinguish known
empty containers from missing conversion data.

Click a container on the map or select it in **Containers** and choose **Inspect
selected container**. A version-1 `use` intention with its canonical source path
asks the authority to approach a cardinal neighbor. Completion exposes only
`{ kind: 'container', targetId }` publicly. The client then sends a separate
`{ version: 1, id, actorId: '0', type: 'inspect', targetId }` intention. The server
rechecks ownership, locks and range and returns the item rows only in the
requesting owner's acknowledgement. Observers and later joins receive no item
list, quantities, parent links or inventory counts in snapshots/lastCommand.

Item rows currently contain stable source ID, sparse slot, a generic category
label, type, prototype ID and supported stack quantity. System item labels use
the limited identification-aware lookup described below. Missing/inconsistent
ownership, unsupported spawning/lock flags, locked containers without authorized
key access and out-of-range inspection fail explicitly. Old rows clear on new actions, walking away, load
and teardown. Inspect itself remains a private read; taking uses a separate
validated intention. Container art animation remains unfinished.
The cardinal range/approach rule remains a development policy.

Bates has three inherited-unlocked empty containers and six locked nonempty
ones. The verified empty dresser at `(78, 86)` is reachable from the movement
baseline; the chest at `(98, 94)` stays locked. Original container scripts, lock picking, theft,
random inventory generation, original equipment, stack and grid/weight rules
remain unfinished. The original actor template's inventory is still unknown,
so Take and Put are unavailable there. Installing ownership overlays changes the
current content identity. Development saves are disposable.

### Whole-item transfers and private actor inventory

The **Your inventory** panel uses only the owner's private `inventory` response.
An absent recovered actor list reports unavailable, never empty. Private reads
consume command IDs without changing world revision or public completion state,
and are available while paused and idle. They reject during movement/checkpoint
IO. A committed external Take, Take All, Put or Load invalidates old private views; stop/load
epochs prevent delayed responses from reviving discarded data.

Take and Put send `{ version: 1, id, actorId: '0', type: 'take' | 'put', targetId, itemId,
expectedRevision }`. The revision must match the fresh inspection. The server
rechecks locks, range, reciprocal ownership, known actor metadata and the narrow
supported whole Generic/standalone Key policy. Both commands name the container; Take
moves container to actor, and Put moves actor to container. A container must be
in the fixed verified attainable set and permit current access. Items initially
held by the known actor or an attainable container can move through this boundary and be taken again from their
new container. It moves the same item to the lowest unused destination sparse
slot, updates both counts and the parent link synchronously, and
leaves item UI placement and quantities unchanged. Instance-only writes avoid
mutating inherited prototype arrays; failure rolls back. Paused, busy, stale,
replayed, unknown and unsupported requests reject explicitly. Standalone Key
transfers require an actor without a keyring, a valid positive key ID, empty item
flags and immutable key metadata. Keyring contents and merging are not inferred.

Take All sends `{ version: 1, id, actorId: '0', type: 'take-all', targetId,
expectedRevision }`, without client-selected item IDs. The server selects the
complete nonempty container set in sparse slot/ID order. It validates every item
and capacity for the complete batch, then replaces both owner lists/counts and
every selected parent in one synchronous transaction. Any unsupported item or
write failure rejects the entire batch. Empty containers return `EMPTY_CONTAINER`.
Success publishes one revision; its private result includes ordered `itemIds`,
empty container `items` and the resulting actor `inventory`. Destination slots
are allocated exactly as sequential Take would allocate them. Current checkpoints
use document schema 6 and ownership rules v10.

Only the owner's acknowledgement carries the resulting container rows and new
actor inventory. Public Take/Take All/Put summaries contain the container target and outcome,
never the selected item IDs, contents, parent or counts. The client validates
disjoint owners and exact item conservation before displaying both lists. Batch
replies must cover the full inspected set in the server's selection order,
preserve every item's metadata and allocate the lowest unused actor slots. An
acknowledgement timeout re-reads ownership instead of retrying the transfer. This does
not implement equipment, stacking/splitting, full magical/stack weight rules, unrestricted ground actions, barter,
keyrings, original item scripts or multiple controlled players.

Private labels now resolve the system `Description` table by the item's permitted
description ID, with original identification gating and safe type fallback.
They are added to private replies after ownership validation; approach signatures,
the ledger and public snapshots remain independent of text. The catalog is
immutable per host and outside the simulation fingerprint, so text-only edits
preserve current ownership saves after restart. Key names, module-specific names,
effects and complete examination remain unfinished. See [private item
names](ITEM_DISPLAY.md) for formats and evidence.

### Key-authorized doors and containers

Door Use remains a target-only intention. The host looks up a directly held
supported Key in verified actor ownership before approach and again on arrival.
ID zero never matches; one on either side is the master case; otherwise IDs must
match. Opening changes the pose and collision, preserves the key and leaves
`Locked` unchanged. Closing an open supported door does not need the key, subject
to the occupied-door guard. Public usability describes structural support and
does not reveal private possession or key numbers.

Key opening requires immutable authored `Portal.keyUseSupported: true` and the
matching `Portal.keyID`. Missing original script references cannot prove a door
has no script veto, so imported locked doors remain rejected. Timed/magical/jammed,
damaged or AlwaysLocked behavior remains unsupported. [Key evidence and the owned
loop](KEYS.md) document this boundary.

Authored containers use immutable `Container.keyUseSupported: true` and
`Container.keyId` (the field spelling differs from portals). Current matching-key
possession is checked before approach, on arrival, for private inspection and
each Take/Put/Take All, including immediately before ownership commit. This is
a per-command authority policy; original container scripts authorize inventory
UI opening through `SAP_UNLOCK` and `SAP_USE`. The current slice requires explicit
authored support rather than assuming discarded script fields were empty.
Neither the lock flag nor key is changed by access. Public container usability
remains structural and does not report private key possession.

At startup the ownership ledger computes an immutable attainable set: known actor
and usable unlocked containers supply keys, which can admit reviewed locked
containers and their supported keys in successive steps. A key inside its own
locked container or an inaccessible cycle supplies no initial access. This
constrains both item movement and saved ownership. Current possession is checked
only for actions, so putting a key away, even into a matching locked crate, does
not invalidate a legitimate checkpoint. That crate then rejects access until
another matching key is held; the slice has no persistent open-container state.

### Authored ground items

A target-only `use` approaches a public floor item. A separate
`pickup { targetId, expectedRevision }` changes ownership at the fresh revision
while in same/cardinal range. `drop { itemId, expectedRevision }` chooses the
actor tile, without client-supplied placement or parent links. Both require known
actor ownership and the ordinary authority/auth/replay/pause/busy guards. Only
the authored whole Generic pebble opts in through immutable
`Item.groundTransferSupported: true` and reviewed static Item artwork.

`groundItems` snapshots contain only currently loose item descriptors. Pickup
removes its ID/name from public floor and completion state; private actor and
container rows retain `canDrop: true`. Clients validate conservation and wait
for commits before updating ownership or floor artwork. Timeout rereads private
ownership instead of retrying the mutation. Loaded sprites are hidden/reused,
and stale asynchronous loading cannot revive a picked-up item.

The source flags and item UI location remain immutable authored metadata; runtime
`entity.ground` and canonical reciprocal ownership determine ground visibility.
Drop supports ordinary walkable floor only, rejecting portal tiles and another
loose item on the same tile. Original multiple-item junk piles, decay, item
scripts, complete magical/stack weight, grid packing, equipment and stack/key ground behavior remain
unimplemented. These are explicit development policies.
See [Ground items](GROUND_ITEMS.md) for primary-source evidence and exact fields.

### Authored conversation and quest journal

The Workshop guide at `(9, 8)` can be clicked or selected in **Conversation**.
The ordinary target-only `use` approaches the speaker; `talk { targetId }`
then privately returns a server-issued page and current journal. Choose a reply
with `reply { targetId, conversationId, optionId, expectedRevision }`. The
opaque turn token is bound to the requesting connection and actor. The host
rechecks the live target, range, revision, offered choice and current verified
item possession before changing quest status. It never accepts a client-proposed
condition, quest status, reward or reply text.

**A closer look** moves from absent to active when accepted, and to completed
only after showing the held Workshop pebble. A floor or container-owned pebble
does not satisfy the condition. Showing preserves the item and grants the
declared 2,100 XP reward; it grants no money or items. Reopening a completed conversation cannot complete it
again. Private `journal {}` reads are allowed while paused and idle. Talk and
journal reads do not publish world revisions; state-changing replies publish
only a generic completion summary, without dialogue, choices or journal rows.

Unrelated actions invalidate the current turn; the client clears stale replies.
An uncertain reply rereads the journal once without resending the choice. Save
and load persist the complete fixed quest-state set alongside ownership and
poses; transient conversation tokens and pages are not saved. Data in
`rules/Conversations.json` is validated and included in the simulation content
identity. It is a bounded authored format, without executable script loading.
See [Dialogue and quests](DIALOGUE_QUESTS.md) for exact limits and original-game
references. Original dialogue import, script execution, NPC speech rules, stat
checks, complete original rewards, timestamps and party conversations remain unfinished.

### Authored character progression and base attributes

The owned actor opts into a server-only progression ledger with
`Critter.progressionSupported: true` and a matching `rules/Progression.json`
version-2 baseline with the explicit `neutral-human` profile and all eight base
attributes. It starts at 0 XP, level 1, 5 unspent Character Points and attributes
of 8. The guide's
`rewardExperience: 2100` commits with completion through one preflighted
transaction; any failed write rolls both back. There is no client XP-award
command. Declining, accepting, forged/unoffered choices and repeated completion
do not grant experience. A positive reward with unsupported actor progression
rejects completion rather than discarding the promised award.

Private `character {}` reads are allowed paused and idle, preserving the active
dialogue turn and public revision. Conversation and journal ACKs include the same
canonical private character view, keeping quest/reward presentation together.
The client validates bounds and revisions, clears stale values after external
reply/load/purchase, and reads the journal plus progression once after an uncertain reply;
it never retries the choice or calculates a reward. Public snapshots and command
summaries contain no character balances.

Reviewed original XP thresholds define levels 1–50. Each attained level grants
one Character Point plus one extra at multiples of five; the bank caps at 56.
XP saturation at 1,300,000 and level 50 is a declared development policy because
the inspected CE level-51 sentinel control flow needs reference-executable
verification. See [Character progression](PROGRESSION.md) for the complete table
and primary-source evidence. Other Character Point purchases, complete derived
gameplay effects, auto-leveling, combat/follower XP and original rewards remain unfinished.

`buy-attribute { statId, expectedRevision }` purchases one permanent increment of
one supported base attribute. The host derives the one-point cost, checks the
cap of 20 and available budget, and commits the point debit, attribute and ordered
event together. A successful purchase invalidates the current dialogue turn and
publishes only `kind: 'buy-attribute'`; the chosen attribute and balances remain
private. The client validates exactly one increment and one debit, applies no
optimistic changes and rereads character state once after an uncertain ACK.
Purchases require an idle unpaused actor; private reads remain available paused.
There is no refund, decrement or respec command.

The private view includes server-selected attribute labels, values, caps, costs
and availability, plus a folded derived preview. The pure neutral profile
computes maximum HP/fatigue, carry capacity, damage bonus, armor adjustment,
speed, healing, poison recovery, reaction and follower limit. It preserves C
integer truncation, extraordinary-at-20 changes and effective stat clamps.
These previews do not install damage, movement-speed, encumbrance, reaction or
follower gameplay. See [Attributes](ATTRIBUTES.md) for exact rules and evidence.

Progression records a bounded ordered history of quest completions and attribute
purchases. Replay begins at the authored baseline, applies each level-up grant
with the 56-point cap at that moment, then checks each purchase's current budget
and cap. Spending before or after an overflowing award can leave different valid
balances. There are at most 256 events; no client supplies this history through
a gameplay command.

This ledger does not reinterpret or mutate legacy `Critter.stats`. Imported
actor data remains unsupported without explicit reviewed opt-in and baseline,
even if those old fields contain plausible XP, level and points.

### Position, door, item ownership, quest and progression checkpoints

The **Checkpoint** panel has **Save checkpoint** and **Load checkpoint**
buttons. One server-owned slot defaults to
`<dataPath>/saves/local-checkpoint.json`, under ignored `local-data/` with the
normal configuration. Save replaces that slot; load explicitly restores it.
Starting a new host still begins at the development spawn. There is no automatic
resume, autosave, shutdown save, slot browser or migration workflow.

The version-6 `openarcanum-local-checkpoint` document contains the actor ID and
integer position, the complete managed door set, the map ID, a save timestamp,
the rules version, a content identity, verified ownership and a complete authored
quest-state array and a character progression record (`null` for unsupported
actors). Supported records include eight attributes and ordered quest/purchase
events; derived previews are recomputed rather than saved. The ownership
section contains complete known owner arrays/counts and item parent links plus
`groundLocation` (`null` while held/container-owned, integer pair while loose).
Only explicitly reviewed whole Generic items can become parentless ground
objects. Placement, runtime ground state and tile registration restore in the
same transaction as ownership, actor and doors. Absent
original metadata remains unknown and untouched. It preserves the fixed item
universe and supported whole-item transfers, without creating new instances.
It does not save base/derived attributes, NPC simulation,
original quests, effects, RNG, world time or active movement.
This is a narrow persistence foundation, not a compatible original campaign save.

The content identity hashes canonical JSON actually loaded by the authority,
including the player template and loose-file overlays. ZIP timestamps and
client texture archives do not affect it. Loaded filenames are relative to the
data root, so relocating identical data preserves identity. A different map,
rules version or simulation-content identity is rejected. The current rules
identity is `movement-doors-ownership-attributes-weight-v10`, using document schema version 6.
Only current development saves are supported; old-rule hashes, compatibility
branches and migration paths are not maintained.

Load validates complete owner/item coverage, unique sparse slots, reciprocal
parents, original immutable item identity and supported reachable transfers.
Sources/destinations outside the fixed attainable set cannot supply fabricated
ownership changes. Reviewed locked-container membership is validated without
requiring the actor to hold its key at load time; new actions require possession. Put may leave holes in actor or container lists. Movable items retain
their untouched original slot or use bounded slots reachable by lowest-unused
allocation around fixed items; a fabricated high slot does not become valid
merely because its count and parent agree. Unsupported items retain their
original owner and sparse slot. Supported key-opened door poses can restore after
the key is put away: eligibility comes from the immutable attainable key universe,
while a new opening attempt still checks current possession. Unsupported doors
and doors with no attainable verified key retain their initial pose.
The bounded history must contain exactly one event for each completed authored
quest and legal one-point attribute increments in chronological order. Replay
reconstructs XP, levels, point overflow/debits and attributes from the immutable
baseline. Forged balances, changed caps, overspending, duplicate rewards or
purchase-before-reward histories reject before world writes. Loading an earlier
checkpoint restores that earlier purchase/reward timeline.

Ownership writes, actor placement, doors, authored quests and character progression
are preflighted before commit and rolled back together on failure. A fresh host can restore taken-item ownership
from this checkpoint; quantities/equipment and complete campaign state remain
outside this format.

Owners send the same version-1 command envelope with `type: 'save'` or
`type: 'load'`; no path or proposed state is accepted from the rendering client.
Observers cannot change or save the world. Commands are rejected while movement,
an approach/use action or checkpoint IO is active. Other mutation requests also
return `BUSY` during IO, and replayed IDs remain rejected after a load.

Checkpoint operations publish a busy status, then a terminal snapshot and
acknowledgement. Success records
`lastCommand: { id, type: 'save' | 'load', status: 'completed', result: { kind, savedAt } }`
and `snapshot.checkpoint` exposes supported/busy state, last action and timestamp.
The client waits for committed state and visual readiness; it does not move the
actor or toggle doors optimistically. Restore uses a new revision and commits
actor occupancy and all door states together. Candidate collision, door identity
and unsupported lock/art state are validated before changing the live world.

Storage writes a private same-directory temporary file, flushes it, and replaces
the slot atomically. The previous slot survives failures before replacement;
directory flushing after replacement is best effort. Missing, corrupt,
incompatible and IO failures return a sanitized `CHECKPOINT_*` code and a
nonfatal status message. A failed load leaves live gameplay state intact.
Storage rejects oversized files and nonregular/symlink targets. Local operator
configuration chooses the slot path; this is not a remote file-selection API.

To run the headless bundle with Node 24, without Electron or a display:

```sh
npm run build:engine
node @openarcanum/agate/dist/authority.cjs --data-path ./local-data \
  --map-id 'Bates Mansion Lev 2' --port 0 \
  --session-file local-data/reference/authority-session.json
```

The optional session file contains the local URL and both credentials. It is
created exclusively with mode `0600`; choose a new path or remove your old stopped
session file before rerunning. Keep it under ignored `local-data/`, and do not
include its contents in reports. The CLI prints readiness without credentials;
`Ctrl+C` stops it. `--config PATH` accepts a local JSON configuration with
`dataPath`, `mapId` and optional `port`/`sessionFile`/`checkpointPath`.
`--checkpoint-path PATH` selects the server's local slot; `--help` lists flags.
There is no public bind option, account service or supported remote hosting mode
yet. Each fresh host starts a new development session until explicitly loaded.

The source entry is
`@openarcanum/agate/src/server/authority/entry.ts`; the build emits
`@openarcanum/agate/dist/authority.cjs`. The legacy `ServerEngine`/`ServerNetwork`
experiment remains in source and is not the path used by this checkpoint.

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
scripts into this Node-enabled renderer. The main process now owns local server
lifecycle through a small IPC surface, but this does not complete renderer
isolation or remove its existing Node-enabled asset/network access.

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

The legacy converted map format uses different coordinate conventions within
one archive: entities and lights store `(originalY, originalX)`, while tile rows
remain `tiles[originalY][originalX]`. The runtime follows the entity coordinates.
It therefore transposes complete tile records, including blocking flags, swaps
map width/height and reads archive sectors as `Sector/runtimeX/runtimeY`.
Sprite projection remains `(40 * (x - y), 20 * (x + y))`; reflecting just the
projection would break wall alignment. Cached source JSON stays unchanged;
locations, sprites and occupants belong to each loaded sector instance.

### Recover roofs and static light metadata

The old C++ converter wrote empty roof rows and exported light validity as an
art ID. The source-only helper below reads the original SEC tables and names,
checks section boundaries and roof ART hotspots against the existing atlas,
then writes a separate loose-file overlay. It does not alter ZIP archives.
The original input must use the retained `#UNPACKED.zip` extracted layout;
this helper does not unpack retail DAT files or replace the full converter.

```sh
node @openarcanum/agate/tools/recover-sector-roofs.cts \
  --original /path/to/your/#UNPACKED.zip \
  --converted 'local-data/archives/Bates Mansion Lev 2.zip' \
  --gfx local-data/archives/Gfx.zip \
  --map 'Bates Mansion Lev 2' --include-lights \
  --output local-data/roof-recovery
```

Use `--dry-run` in place of `--output` to validate without writing. The output
directory must be new and inside this checkout's ignored `local-data/`.
Review `recovery-manifest.json`, then copy its `Bates Mansion Lev 2` folder
into `local-data/` as a new loose map folder; retain existing loose files if
present and resolve their differences before replacing them. Loose map JSON
takes precedence over ZIP entries, while entity records and graphics still
come from the unchanged archives. Relaunch after installing an overlay.

Roof grids keep original rows/columns until runtime loading transposes them.
Each roof cell spans 4x4 ground tiles; original piece footprints and directional
boundaries control interior hiding and covered-art occlusion. Edge fading is
not implemented. The roof group remains above the sorted objects.

For Bates, original `mapinfo.txt` selects lighting scheme 2. The retained
`Module template/Rules` defines that scheme as constant indoor RGB `(74,80,98)`
and outdoor `(0,0,0)`; this template-rule provenance is recorded explicitly in
the manifest. The helper prefers actual module Rules when available and rejects
variable schemes. Static lighting adds original mask colors to ambient, then
multiplies floor artwork. Characters, props and doors receive one color sampled
at their original ground position, using decoded atlas pixels and per-light
integer truncation. Samples follow interpolated movement; portal sides select
their original adjacent half-tile. Sprite height, animation hotspots and camera
transforms do not move those samples. Cached tints avoid adding a light filter
to every ordinary object. `DontLight` and blend effects
stay unlit in their existing depth order; roofs use outdoor ambient and GUI
art is unaffected. Walls still use the floor-filter approximation; original
side-dependent ambient, visible-side light selection and endpoint gradients
remain unfinished. This first pass supports homogeneous environments and
zero-flag static lights. Mixed indoor/outdoor maps, time-dependent ambient,
original 40x20 vertex sampling, wall gradients, shadows and animated or
object-attached lights remain unsupported.

Launch with `npm run start:built`, then choose **Start local map**. Click a clear
floor tile to walk, or click a supported door to approach and use it. The **Doors**
panel offers the same action with visible status. Drag the map to pan and use the mouse wheel to zoom. The
development actor starts at `(92, 99)`. Movement currently uses a fixed one-second
tile duration, rather than verified original speed rules. The legacy GUI windows
are scaffolding; their presence does not imply working character or inventory
rules. The local authority owns movement and door state; the client animates
movement snapshots and applies committed door poses.
Use **Save checkpoint** while idle to retain position and doors, then **Load
checkpoint** to restore that slot. Other campaign state is not included.
NPC AI and the old fixed-damage combat demonstration are disabled in both the
headless host and this rendering checkpoint.

To run the local scene check and retain diagnostics privately:

```sh
npm run smoke:game -- --show \
  --game-smoke-report=local-data/test-results/game.json \
  --game-screenshot=local-data/test-results/game.png
# Also exercise local-session replacement and reload lifecycle:
npm run smoke:game -- --show --game-lifecycle
```

The check starts the scene, awaits map/atlas/player readiness, walks a known clear
path, rejects blocked, wall and void targets, clicks a real floor tile through
Electron mouse input, and observes subsequent frames. It fails on renderer
exceptions, console errors, stopped updates or failed local resource requests.
The [door smoke](../ember-electron/door-smoke.cts) then approaches, opens, closes
and reopens a real door, traverses its tile, verifies occupied-close rejection,
and restores the original door/actor state. A separate authenticated observer
checks authoritative completion; actual texture frames and collision are asserted.
The [checkpoint smoke](../ember-electron/checkpoint-smoke.cts) then saves an open
door and the adjacent actor, changes both, loads the slot and verifies restored
position, door artwork, collision and matching observer state. It restores and
saves the closed-door regression baseline; visible runs activate the final save
through the actual UI button. The [container smoke](../ember-electron/container-smoke.cts) then approaches the recovered empty dresser, verifies private inspection and a matching public observer summary, rejects the original locked chest, exercises the visible Inspect button and returns to the same actor baseline. Automated game runs use a private temporary slot
so a user's normal checkpoint is untouched. Without `--show`, native pointer
verification is omitted. Keep reports, screenshots, converted data and saves
under the ignored directory.

The optional `--game-lifecycle` check runs after the scene assertions and before
final teardown. It exercises real desktop session lifecycle, including reload,
in addition to the owned-fixture session-controller and child-process tests.
Treat its result separately from ordinary scene smoke success; the base scene
run does not by itself verify reload/startup cancellation races.

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

- The current local authority supports one controlled actor and read-only
  observers over loopback. Multiple controlled characters, public admission,
  module/version negotiation, durable campaign sessions and campaign co-op remain absent.
  The separate historical server/player/world experiment is unfinished and is not
  used by normal desktop startup.
- The headless host and rendering client load converted map and prototype data
  independently. Eight duplicate source GUID records are preserved under distinct
  runtime IDs. Original movement fidelity
  and dynamic obstacle changes still need validation. Path searches use a bounded
  region and can miss routes requiring longer detours. Eight explicit duplicate-ID
  warnings document the supplied dataset rather than silently dropping records.
- Typed ground records, including `BlackYall` artwork, are rendered; empty
  records remain void. Collision follows the converted terrain and object flags.
  Traversal semantics still need verification across the whole map; the short
  smoke-test path does not establish complete collision fidelity.
- Historical roof/light JSON needs the local recovery overlay described above.
  Recovered roof placement, hiding and occlusion work in the Bates checkpoint;
  edge fading and nonzero initial fill flags need further work. Static lighting
  remains an approximation with the boundaries listed above.
- Historical NPC movement and combat scaffolding remains in source but is disabled
  in this scene; it does not implement original AI or combat rules.
- Door use and container inspection support only the subsets described above.
  Standalone keys work with explicitly supported authored doors and containers;
  keyrings, lock picking, traps, scripts and original action timing
  remain unfinished.
  Position and managed door state have one manual local checkpoint slot. The
  original seven-frame artwork is displayed at committed
  endpoints rather than animated through its transition.
- Original dialogue/scripts/quests, inventory/equipment rules, magic,
  complete progression and derived statistics, followers, world time, travel and
  persistent campaign state need implementation or substantial integration.
  The owned guide and XP/level/point ledger exercise a narrow supported subset.
- GUI windows and metadata are not proof of the corresponding gameplay system.
- Converter correctness needs real fixtures. AI numeric parsing currently drops
  minus signs, and `!!"0"` produces an incorrect true door-opening flag.
- The historical converter omitted container/critter inventory lists and item parents.
  [Original MOB recovery](INVENTORY_RECOVERY.md) restores those links for Bates
  and enables private inspection. The owned workshop verifies whole Generic and
  standalone Key transfers and supported door access; complete original inventory
  rules remain unfinished.
- Regression tests cover local authority/observer ownership, replay rejection,
  startup and shutdown, movement, door state and checkpoint failure/restore,
  blocking, sprite atlas changes,
  local GUI data, asset prerequisites, cache behavior and converter text decoding.
  The real-data scene check is a narrow smoke test, not campaign validation.
- Electron compatibility mode still needs a complete IPC boundary before a
  supported end-user distribution.
- Stopping cancels scene updates, pending movement and the owned local server.
  Full Pixi resource and
  event-listener disposal across repeated route changes still needs work.

## First playable checkpoint

The current Bates Mansion scene establishes map loading, local authoritative
movement and a narrow door-use foundation. Finish the M0/M1 content, lifecycle and compatibility gates
while preserving its visual regression coverage, then complete one sequence
through that same client/server path:

1. Reproducible install/build and original map loading from local data.
2. Player movement, container pickup and equipment with actual state effects.
3. A Virgil conversation with a real condition, response effect and quest flag.
4. One encounter with specified hit, damage, fatigue and death rules.
5. Save/reload restoring player, inventory, quest, NPC and party state.
6. Travel to another map and back with the same consequences preserved.

Use the [original-game oracle](ORACLE.md) to check specified behavior. Record
deterministic state assertions and known unsupported boundaries. Add campaign
co-op after this local-server slice; persistent-world scale follows measured
networking, persistence and operating budgets. See the roadmap's M0–M6 gates.

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
