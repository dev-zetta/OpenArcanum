# Changelog

Day-by-day retrospective of the available Git history. Historical dates use the
original author timestamp converted to **Europe/Prague**; days without commits
are omitted. Entries describe recorded source snapshots and integration work,
not verified feature completion or the exact date every line was written.

All 77 historical commits from the Electron, asset-db and asset-converter
repositories are included. Links use their rewritten canonical hashes. The
converter's unmerged GlobalConverter history is included. Asset-database entries
document historical work whose retail-derived payloads are excluded from this
source publication. See [HISTORY](docs/HISTORY.md) for provenance and filtering.

## 2026-10-13

- Committed and pushed the previously validated local-authority foundation as
  [`11aa4cb`](https://github.com/dev-zetta/OpenArcanum/commit/11aa4cb84ee8a979fd12ca9f34911c898eab2639).
  Publication review confirmed owned Workshop binaries and excluded retail
  inputs, reference captures, credentials and build output.
- Added permanent purchases for the eight owned neutral-human base attributes:
  one point per increment, capped at 20. The server checks current revision,
  budget, actor permissions and idle/unpaused state, then commits the attribute
  and debit atomically. Private ACK conservation checks and one-time recovery
  reads prevent optimistic or duplicated purchases.
- Added ten private derived previews with reviewed rounding, extraordinary
  values and clamps. These values are separate from incomplete legacy stats;
  combat, movement speed, weight enforcement, effects and follower behavior
  remain unfinished. Refunds, respec and other point purchases remain absent.
- Added progression definition version 2 and checkpoint schema 6 / rules v9.
  Ordered quest/purchase events preserve the moment of bank overflow, validate
  every point debit and match the completed quest set. Save/load restores the
  corresponding purchase/reward timeline and recomputes previews. Expanded the
  owned fixture and [attribute documentation](docs/ATTRIBUTES.md).
- Passed 506 Node tests, 82 UI tests with 712 assertions and production build.
  Native Workshop input spent the five starting points, restored an earlier
  purchase checkpoint, earned and spent the quest point, rejected an unfunded
  purchase, and displayed the reviewed derived values. The full scenario took
  about 102 seconds before lifecycle checks. Private observer boundaries and
  unchanged legacy stats were verified. Bates rendering, movement, doors,
  containers, pause, checkpoints and lifecycle passed; both game reports captured
  no application errors or failed requests. Existing build/desktop warnings remain.
- Added authoritative owned-character XP, level and banked Character Points.
  The Workshop actor explicitly starts at 0 XP, level 1 and 5 points; completing
  **A closer look** now grants 2,100 XP, reaches level 2 and banks a sixth point.
  Quest completion and progression share one atomic transaction. Replays, racing
  replies, declining and merely accepting do not duplicate the award.
- Added private Character reads and UI values, including the next total XP
  threshold. Conversation and journal ACKs carry the same private progression
  view. Paused idle reads preserve active dialogue; observers receive no XP,
  level or point balances. Uncertain replies reread state without retrying.
- Added checkpoint schema 5 / rules v8 for consistent quest/progression state
  alongside supported ownership and poses. Save validation reconstructs XP from
  completed authored rewards and rejects fabricated balances; earlier-timeline
  load and fresh-host restore retain the corresponding reward state. Original
  actors remain unsupported without explicit opt-in, and legacy stats stay intact.
- Added reviewed numeric XP thresholds through level 50, one point per gained
  level plus an extra every fifth level, and the source-defined 56-point bank
  cap. XP saturation at 1,300,000 is an explicit development policy pending
  reference verification of the original cap edge. Character Point spending,
  derived statistics and complete original rewards remain unfinished.
- Extended the deterministic owned module to 89 files and added
  [progression evidence](docs/PROGRESSION.md), updating the pitch, roadmap and
  player/development instructions.
- Passed 465 Node tests, 76 UI tests with 665 assertions and production build.
  Native Workshop input verified private balances, exactly-once completion,
  active/completed reward checkpoints, earlier-timeline replay and terminal
  reopening without extra XP. The full Workshop scenario took about 102 seconds
  before lifecycle checks. Bates rendering, movement, doors, containers, pause,
  checkpoint and lifecycle checks passed; reports captured no application errors
  or failed requests. Existing build and desktop/driver warnings remain.

## 2026-10-12

- Added the owned **Workshop guide** and **A closer look** quest. Talk approaches
  the NPC, then privately offers server-selected replies. Acceptance records an
  active quest; showing the currently held Workshop pebble completes it without
  consuming the item or granting rewards. Declining leaves the journal empty,
  and a completed conversation cannot repeat the transition.
- Added connection-bound conversation turns, fresh-revision replies, current
  inventory-condition checks and a private journal. Movement, pause, checkpoints
  and other world actions invalidate old replies. The client clears stale
  choices and rereads the journal once after an uncertain reply without retrying
  it. Observers receive NPC descriptors and generic completion summaries.
- Added checkpoint schema 4 / rules v7 for the complete authored quest-state
  set, restored atomically with position, doors and supported ownership. Transient
  dialogue pages are reopened after load. The bounded authored rules file is
  part of simulation identity; original DLG scripts, stat checks, rewards,
  quest timestamps and party dialogue remain unfinished.
- Extended the owned module to 88 deterministic data files with a stationary
  ochre-clothed guide, eight directions of generated Stand artwork and declarative
  conversation data. Added native Conversation and Journal sections in one
  scrollable interaction stack, plus [dialogue evidence](docs/DIALOGUE_QUESTS.md)
  and updated pitch, roadmap and development instructions.
- Passed 422 Node tests, 70 UI tests with 614 assertions, and production builds.
  Native Workshop input verified acceptance, held-item reply filtering,
  nonconsuming completion, active/completed checkpoint restores, terminal
  reopening, guide-artwork clicks and expanded journal text. The full scenario
  took about 102 seconds before lifecycle checks. The separate Bates rendering,
  movement, door, container, checkpoint and pause regression passed. Reports
  captured no application errors or failed requests. Initial malformed-ground
  fixtures were isolated from unrelated dialogue rules before the passing rerun.
- Added the first authored whole-Generic ground pickup/drop loop. The new
  **Workshop pebble** has procedural artwork at `(4, 7)` and an explicit reviewed
  opt-in. Ground Use chooses the approach; a separate fresh-revision Pickup
  transfers ownership. Drop names only the held item and lets the server choose
  the actor tile. The existing token, keepsake and key retain their prior rules.
- Added public loose-item descriptors and private Drop capabilities. Pickup
  removes the held item's ID/name from public floor and completion state in the
  same commit. Client conservation checks, ownership epochs and timeout rereads
  prevent optimistic or duplicate inventory; stale artwork loading cannot revive
  a picked-up item. Native artwork clicks and the Ground items panel share the
  same server commands.
- Added schema 3 / ownership rules v6 checkpoints for reciprocal parent links
  and validated ground coordinates. Placement, tile registration, actor, doors
  and ownership restore atomically. Source flags and item UI locations stay
  immutable authored metadata; runtime ground state drives visibility. Portal
  tiles and another loose item on the same tile reject placement. Original
  scripts, junk piles, decay, stack/Key ground rules, weight and grid packing
  remain unfinished. Development saves remain disposable.
- Extended the deterministic owned workshop to 68 data files, including the
  pebble prototype/instance and its PNG atlas. Added ground behavior/evidence
  documentation alongside the current pitch and roadmap.
- Passed 382 Node tests, 64 UI tests with 542 assertions and production build.
  The visible workshop passed native panel Pickup/Drop, artwork-click approach
  and pickup, native container Put/Take preserving Drop capability, held/floor
  checkpoint restoration, all prior token/key/container/door loops and host
  lifecycle. The separate Bates rendering/movement/door/container/checkpoint/
  pause/lifecycle regression passed. Final reports captured no application
  errors or failed requests, recorded authority children were reaped, and all
  68 generated owned files remained unchanged after gameplay.
- Added matching-key access to explicitly reviewed locked containers. The host
  checks possession before approach, at arrival, inspection and each whole-item
  transfer, including commit preflight. Access preserves `Locked` and the key;
  putting the key away immediately revokes further access. Original Bates locks
  remain unchanged because converted script attachments are incomplete.
- Extended the immutable ownership universe through an initial attainable-key
  chain. Reviewed locked containers can supply later keys, while self-locked
  keys and inaccessible cycles cannot bootstrap access or forged saved ownership.
  Current possession guards actions separately from saved-state validation:
  even putting the matching key inside its locked crate remains a valid save,
  although another matching key is then needed to access it. Schema 2 checkpoints
  now require current ownership rules v5; older saves remain disposable.
- Added a third owned workshop crate at `(6, 8)` holding the named **Workshop
  keepsake**, accessible with the existing standalone key. All 63 data files,
  including updated catalogs and manifest, are generated deterministically.
  Locked-container UI controls use the existing private server actions; clients
  supply no key numbers or possession decisions.
- Passed 349 Node tests, 60 UI tests with 496 assertions and production build.
  Core/socket coverage includes key chains, inaccessible cycles, arrival/commit
  rechecks, atomic failure and save/restart after putting the key inside the
  locked crate. The visible workshop passed native locked-crate Inspect, Take,
  Put and Take All, keepsake checkpoint restoration, key-away rejection, its
  existing token/door loops and host lifecycle. An observer matched public actor,
  door and container state without receiving private contents or key metadata.
  The original-data Bates movement/door/container/checkpoint/pause/lifecycle
  regression also passed. Reports captured no application errors or failed
  requests; recorded authority children were reaped and all 63 owned files stayed
  byte-for-byte generated.
- Added whole standalone-Key Take/Put/Take All through the authoritative
  ownership transaction, alongside Generic items. Key metadata and component
  identity are immutable; actors with keyrings remain unsupported to avoid
  inventing original ring merging. Mixed supported batches retain identity,
  counts and lowest-free placement, while unsupported contents reject atomically.
- Added target-only matching-key door access. The host checks actual ownership
  before approach and at arrival, follows zero/master/equality matching, preserves
  the key and leaves `Locked` unchanged. An open supported door can close after
  the key is put away; reopening requires possession again. Key access needs an
  explicit reviewed `Portal.keyUseSupported` declaration because the historical
  converter discarded script references. Original Bates locks and unknown actor
  inventory remain intact; container keys, rings, sharing and lock picking are
  unfinished.
- Extended the owned workshop with a separate key crate and matching locked
  door, retaining its initial empty actor and original token loop. All 60 data
  files are generated deterministically. Current schema 2 / ownership rules v4
  restore key-opened door poses after the key is put away, using the attainable
  immutable key universe. Removed older-rule hash and compatibility branches;
  development saves are disposable and only current rules are supported.
- Passed 329 Node tests, 59 UI tests with 480 assertions and production build.
  Core and socket scenarios cover matching/master/wrong/missing keys, immutable
  metadata, arrival rechecks, races, unsupported keyring/script behavior, pose
  rollback and fresh-host saves after putting the key away. The visible workshop
  passed native key inspection/Take/door Use/Put, traversal, no-key closing,
  rejected reopening and restoration of an open locked door with its key back in
  the crate. Its original token loop and host lifecycle also passed, with no
  captured application errors or failed requests. The separate original-data
  Bates movement/door/container/checkpoint/pause/lifecycle regression passed;
  all 60 generated owned assets remained unchanged after gameplay.
- Added private item names from converted system description IDs, following the
  original known/unknown identification gate. Missing unknown descriptions never
  reveal the known name. Bounded, immutable per-host catalogs support array and
  ordinal-object converter shapes, reject ambiguous/malformed entries and keep
  type fallbacks. Keys, module-specific names and complete examination remain
  unfinished. Names decorate only private replies after ownership validation;
  public snapshots, ownership signatures and the ledger contain no catalog text.
- Authored **Workshop token** through explicit prototype naming fields and an
  owned description table; the deterministic example now has 56 data files.
  Added fields change the earlier unnamed workshop's development fingerprint,
  so old workshop checkpoints may reject while retaining their files. Text-only
  catalog edits preserve otherwise compatible saves after host restart; schema 2
  and ownership rules v3 remain unchanged.
- Passed 295 Node tests, 56 UI tests with 447 assertions and production build.
  Original prototype/MOB evidence supports the naming gate; tests cover unknown
  and missing fields, ambiguous text, private labels, escaped UI text and
  text-only save compatibility. The visible owned workshop verified the named
  token across native inspection, Take/Put/Take All and ownership restoration,
  with no captured application errors or failed requests and clean host lifecycle.
  The separate Bates movement/door/container/checkpoint/pause/lifecycle regression
  also passed; all 56 generated owned assets remained unchanged after gameplay.
- Added atomic server-owned Take All for nonempty containers whose complete
  contents satisfy the existing whole-Generic transfer rule. The host selects
  items in sparse slot order and fills the actor's lowest unused slots. Any
  unsupported item, insufficient bounded inventory space or failed write leaves
  all items with their prior owners. Private replies include the ordered batch;
  observers receive one completion revision without item IDs or contents.
  Native UI uses the shared transfer guard and validates full item conservation
  before updating either owner view. Checkpoint schema 2 and ownership rules v3
  remain unchanged because the resulting ownership is reachable by single Takes.
- Verified Take All against multi-item fixtures, mixed-item atomic rejection,
  failed second-parent writes, concurrent single/batch requests and fresh-host
  save restoration. Passed 284 Node tests, 55 UI tests with 436 assertions and
  production build. The visible owned workshop passed native Take All, empty
  rejection, saved-state restoration and lifecycle checks with no captured
  application errors or failed requests. The original-data Bates scene passed
  movement, doors, read-only containers, checkpoints, pause and lifecycle again.
  Original corpse/equipment/stack/weight rules remain unfinished.
- Added server-owned whole Generic-item Put into verified accessible containers,
  including another container and items initially owned by the known actor.
  The token can be taken, put and taken again with the same identity; both
  directions allocate the lowest unused destination slot and preserve item UI
  placement. Private actor rows expose Put only for the freshly inspected
  selected container; shared transfer validation rejects duplicate, stale,
  unauthorized, locked, paused or conflicting intentions without optimistic UI
  ownership changes.
- Extended checkpoint rules to preserve legitimate inventory holes after Put.
  Document schema remains version 2; new rules use ownership-v3. Safe saves from
  ownership-v2 load only after old content identity and Take-only transition/slot
  validation, without automatic disk rewrite. Version-1 saves remain incompatible.
- Verified native Take/Put/re-take, duplicate rejection and restoration of a
  saved Put state in the asset-free workshop. Socket tests cover competing Put
  requests and a fresh host restoring an actor inventory with a legitimate gap.
  Validation passed 266 Node tests, 50 UI tests with 381 assertions and
  production build; older-rule compatibility also passed an independent raw
  content hash check.
  The visible Bates movement/door/container/checkpoint/pause/lifecycle regression
  passed. Both game reports captured zero application errors or failed asset
  requests and reaped all recorded authority children; bundled assets stayed
  byte-for-byte unchanged.
- Added server-owned whole Generic-item Take and a private actor inventory panel.
  Fresh inspection revisions, explicit actor ownership, locks/range and replay
  checks guard each transfer. Reciprocal owner lists/counts and the item parent
  change together without editing prototype arrays or item UI placement.
  Delayed/indeterminate acknowledgements cannot optimistically create items;
  the client re-reads ownership instead of retrying mutations.
- Added checkpoint version 2 with complete verified ownership, strict item/owner
  universe validation and atomic position/door/ownership restoration. Known
  content identity and supported transitions constrain loads; original unknown
  actor metadata and locks remain intact. Version-1 saves report incompatibility.
  Equipment, stacks, weight, dropping, barter, keys and full campaign saves
  remain unfinished.
- Verified native Take, duplicate rejection, private inventory and restoration
  of the same token to either owner in the asset-free workshop; a new host also
  restores taken-item ownership. The visible Bates rendering, door, container,
  pause, checkpoint and lifecycle regression passed. Validation passed 248 Node
  tests, 45 UI tests with 322 assertions and production build. Both game runs
  captured zero application errors/failed requests and reaped recorded hosts.
- Added a bundled owned inventory workshop that runs without retail assets:
  an animated actor, 120 floor tiles, a door and an accessible container holding
  one uniquely identified item. Deterministic source generates its JSON, PNG
  artwork, ZIP catalogs and manifest. Explicit map spawning, stable actor source
  identity, PNG sprite metadata and a retail-GUI bypass support this module.
  Launch with `npm run start:workshop`; item transfer remains unfinished.
- Verified workshop private nonempty inspection, observer privacy, native
  movement/Inspect/Pause input, door traversal, paused checkpoint restoration and
  stop/reload/restart lifecycle with a nonexistent retail-data path. The Bates
  regression also passed. Validation passed 218 Node tests, 38 UI tests with
  269 assertions and production build; both visible game runs captured no
  application errors or failed requests and reaped every recorded host PID.
  Module checkpoints remain outside the example, in ignored local storage.
- Added server-controlled local pause/resume with an explicit host capability.
  Mid-tile movement, pending approaches and client world animation freeze while
  the interface remains responsive; resume excludes paused wall time and
  preserves the original movement command. Idle paused checkpoints work, and
  fresh hosts begin running. Multiplayer pause rules remain unfinished.
- Verified native Pause/Resume in the real Bates scene: fractional position,
  animation and host progress remained frozen while rendering continued;
  observers matched and idle paused save/load succeeded. Validation passed
  206 Node tests, 32 UI tests with 196 assertions, production build and visible
  scene/session lifecycle checks, with no captured application errors or failed
  asset requests and every recorded host PID reaped. Added timeout and
  superseded-state recovery for delayed pause confirmation.
- Added strict local recovery of original MOB/prototype inventory ownership,
  producing instance-only owner lists and item parents with reciprocal checks,
  preserved sparse indices and ignored provenance manifests. Original item UI
  locations and quantities remain independent and unchanged.
- Added server-controlled container approach and read-only inspection. Contents
  arrive through a separate private owner acknowledgement and are excluded from
  public snapshots. Locked/unsupported/malformed targets reject explicitly;
  native map clicks and a Containers panel use the same authority path.
  Transfer, keys, lock picking, equipment and item persistence remain unfinished.
- Validated and installed local ownership overlays for 53 original MOBs and
  19 prototypes. The visible Bates run inspected an authentic empty dresser,
  preserved the locked chest, verified private contents against an observer and
  exercised native Inspect input. Validation passed 189 Node tests, 26 UI tests
  with 150 assertions, production build and visible scene/session lifecycle
  checks, with no captured application errors or failed asset requests and all
  recorded host PIDs reaped. Retail data and test evidence remain ignored.
- Added owner-only local checkpoint save/load for the controlled actor's position
  and managed door states. A versioned document binds the slot to loaded content
  and rules; validation completes before world state changes. Temporary-file
  writes and atomic replacement preserve the prior slot on precommit failure.
- Connected **Save checkpoint** and **Load checkpoint** controls to server
  intentions with busy/completion status and recoverable errors. Reload applies
  actor occupancy, collision and artwork through authoritative snapshots. This
  is one manual local slot; campaign, item, NPC, quest, RNG and world-time state
  are not saved, and fresh hosts do not automatically resume it.
- Verified position/door save, modification and restore in the real Bates scene
  with matching observer state, original texture/collision restoration and
  native **Save checkpoint** input. Final validation passed 140 Node tests,
  22 UI tests with 117 assertions, production build, startup/WebGL checks and
  visible scene/session lifecycle checks. No captured application errors or
  failed resource requests occurred; all recorded host PIDs were reaped.
- Recorded a read-only inventory ownership investigation: all 53 original Bates
  MOB records parse exactly, all 32 item parents resolve, and 13 container
  memberships reciprocate. The old converter omitted both directions. No
  proprietary records were added. Recovery tooling was added in the subsequent
  inspection slice described above; looting remains pending.
- Added server-owned approach/use for supported converted doors, identified by
  exact source-entry paths. The host revalidates targets, applies lock policy,
  rejects closing an occupied doorway, and replicates door state and collision.
- Connected native door clicks and a status/selection panel to the same use
  command. The renderer pins the committed original closed/open frame; transition
  animation, keys, lock picking and scripts remain pending. Read-only containers
  were added in the subsequent inspection slice described above.
- Preserved nested instance-only fields and explicit zero values when overlaying
  converted records onto prototypes, including initial door frames. Managed door
  collision now follows committed open/closed state even when a converted open
  door inherited `NoBlock`, without modifying the original flags.
- Verified a real Bates door through native opaque-art input, server-chosen
  approach, owner/observer state, open/closed texture frames, traversal and
  occupied-close rejection, then restored the scene. Combined validation passed
  115 Node tests, 18 UI tests with 87 assertions, the WebGL fixture and the visible
  scene/session lifecycle run, with no captured runtime errors or failed requests.
- Added the first local authoritative movement foundation. Desktop startup owns
  a headless Node child on an ephemeral loopback port, with private owner and
  observer tokens and a versioned command/snapshot protocol.
- Loaded collision and prototypes independently on the host; validated command
  shape, actor ownership, destinations, paths, busy state and replayed IDs.
  Movement uses a fixed one-second-per-tile server clock; the client interpolates
  snapshots for presentation. Original speed rules and world time remain pending.
- Added a standalone headless build/CLI, authenticated observer protocol checks
  and local child-process lifecycle tests. This checkpoint controls one actor;
  complete campaign persistence, combat, inventory, dialogue and campaign co-op remain unfinished.
- Verified server movement while rendering is paused, matching observer state,
  native floor input and real desktop reload with overlapping session requests.
  Session leases prevent abandoned starts and stale cleanup from affecting a new
  host. Validation passed 94 Node tests and 14 UI tests with 64 assertions.
- Added desktop session leases and startup-generation cancellation so abandoned
  reload/close requests cannot restart a host and stale component cleanup cannot
  stop its replacement. Added an optional real session/reload smoke mode.
- Added a local reference-game oracle with fingerprinted working copies, isolated
  Wine/Xvfb execution, input/capture evidence, matched image comparisons and
  Ghidra analysis/decompilation. Tool binaries and generated evidence stay private.
- Added a crop-aware PDF manual converter with physical-page anchors, searchable
  HTML/Markdown, shortcut tables and facsimiles for artwork and raster tables.
- Defined the renewed game pitch and 47-family feature roadmap: authoritative
  local-server singleplayer, campaign co-op, versioned mods, multiplatform clients
  and later measured persistent-world hosting. These are targets, not completed modes.
- Aligned legacy floor art and terrain blocking with object coordinates. The
  converter reverses entity X/Y but keeps original tile rows; loading now
  normalizes tile grids, sector paths and rectangular map dimensions together.
- Kept per-sector locations, sprites and occupants separate from cached asset
  JSON, preventing reloads from modifying another map instance's state.
- Removed forced wall/door transparency, honored converted object opacity and
  restored typed black ground artwork. Corrected the floor hotspot alignment
  and changed the canvas void background to black.
- Corrected object depth units and made equal-depth insertion independent of
  asynchronous atlas load order, with same-tile walls drawn before doors. Added
  asymmetric map, cache isolation, concurrent loading, opacity and actual WebGL
  pixel regressions.
- Enabled click-to-walk on rug Facades as well as ordinary floor tiles; verified
  native mouse movement and all 2,983 typed ground records in the local scene.
- Added validated SEC roof/light recovery into separate local overlays, retaining
  source archive hashes and the original constant ambient scheme provenance.
- Restored 72 Bates roof pieces with original hotspots, mirrored pieces,
  connected interior hiding, covered-art occlusion and transparent mouse hits.
- Added four original static light masks with ambient multiplication, camera
  alignment and resize handling. Original `DontLight` and blend effects retain
  their brightness and depth order; roof edge fading, light animation, shadows
  and original wall vertex gradients remain unfinished.
- Corrected characters, props and doors to use one light color sampled at their
  original ground position, instead of projecting floor illumination up their
  artwork. Samples follow movement, retain portal-side offsets and use original
  integer color multiplication. Ordinary objects now use cached sprite tints;
  walls retain the current filter approximation and fire effects stay unlit.

## 2026-10-11

- Resumed active development of the Electron/JavaScript OpenArcanum project.
- Published a source-only monorepo with the three preserved project histories;
  normalized author and committer identities to the maintainer's current Git
  configuration while preserving dates and contributor acknowledgement.
- Recovered the latest legacy working-tree source beyond the December 2019 commit.
  Its original development dates are unknown; this entry records its import.
- Applied GPL-3.0-or-later to project-authored source, corrected converter license
  metadata, retained upstream notices and documented contributor credits.
- Replaced the template README with implementation status, recovery instructions,
  historical articles, archived fundraising links and six video demonstrations.
- Removed game assets, application bundles, local dependency directories and the
  old OAuth credential from the entire published history.
- Replaced workstation-specific application paths with project-relative
  configuration and an optional data-directory environment override. Optional
  OAuth credentials now come from the environment. Removed unused local physics
  dependency references and the extracted-item inventory demonstration.
- Replaced the stale legacy lockfile with a current npm-workspace dependency lock.
- Migrated to Electron 44.7, Ember / Ember CLI 7.3, PixiJS 8.22, Viewport 6,
  Socket.IO 4 and Vite 8.3. Removed retired Electron compilation, native fibers,
  Git-branch packages and obsolete UI addons; retained Babel 7 for upstream
  Ember build-plugin compatibility.
- Added build-time Flow compilation, a direct Electron launcher, contained local
  asset protocols, portable preload configuration and an explicit missing-data
  screen. Migrated Ember templates, local GUI data loading and Pixi texture,
  viewport and shader APIs.
- Added engine, converter, protocol, UI and actual WebGL rendering regression
  checks, plus a current Node 24 build workflow. The synthetic renderer check
  verifies atlas and filtered sprite pixels without original game assets.
- Updated connection rejection handling for Socket.IO 4 and covered rejected
  handshakes with a packet-level regression test. Configured the CI runner's
  Electron user-namespace permissions without disabling Chromium's sandbox.
- Added an explicit SwiftShader mode for synthetic rendering checks on headless
  runners while retaining the default GPU rendering check for local development.
- Restored an explicit offline Bates Mansion Lev 2 scene with awaited sector,
  prototype, texture and controlled-actor loading; bypassed the unfinished server.
  Fixed sector archive coordinate ordering, duplicate source-ID preservation,
  prototype component identity and inventory-only art handling.
- Added animated click-to-walk movement with tile, wall and void rejection,
  occupancy updates and safe Walk-to-Stand atlas changes. Original gameplay rules
  and campaign systems remain unfinished.
- Gave offline simulation its own elapsed-frame timing, excluding startup time
  and retaining delayed movement updates; guarded movement preparation against
  stopped clients and kept the network scheduler separate.
- Unified the viewport and renderer's Pixi module instance so native pointer
  hit testing works; paused sprite updates during asynchronous animation changes
  to prevent the previous Walk frame leaking into a single-frame Stand atlas.
- Repaired legacy GUI callback binding, nested widget IDs, dynamic child creation,
  stylesheet loading and slot-only inventory drag initialization. Startup and
  later runtime failures now surface with their original error details.
- Added a local real-data scene smoke check with movement, native mouse input,
  delayed-error monitoring and optional private diagnostics. Kept converted game
  assets, reports and screenshots under the ignored local-data directory.
- Made the UI test command build its engine prerequisite so the real runtime
  integration tests work in a fresh source checkout without cached build output.
- Removed a subsequently discovered commented login block from affected published
  history, retaining a private backup and updating canonical history links.
- Documented known implementation gaps and the first offline playable checkpoint.
  A successful development build does not establish a playable game release.

## 2019-12-06

- **Electron / AGate:** Reworked AI evaluators and actions and client controls and startup; revised entities, world and render updates and exported distribution files. ([`594b8771`](https://github.com/dev-zetta/OpenArcanum/commit/594b8771665f2f2d6dafa89d8a65b8e3cd8fe761))

## 2019-07-12

- **Electron / AGate:** Revised server join and request handling and client command evaluation; reorganized render filters and shaders and entity-manager startup. ([`bbc10cf4`](https://github.com/dev-zetta/OpenArcanum/commit/bbc10cf490301cc0d4ce1b0e683a96a3ae32b90c))

## 2019-07-03

- **Electron / AGate:** Revised frame synchronization, movement and waypoints, entity updates, serialization and sprite and scene rendering. ([`ffb09bbe`](https://github.com/dev-zetta/OpenArcanum/commit/ffb09bbe9c45de116dbdf6591a392739b595f832))

## 2019-06-28

- **Electron / AGate:** Reworked entity management around components, pools, events and messaging. ([`d30b5494`](https://github.com/dev-zetta/OpenArcanum/commit/d30b54943adcbcdc11ff81a013fe10adff9f11da))

## 2019-06-23

- **Electron / AGate:** Introduced PIXI integration and revised Lance-derived client, server and network code. ([`1a7f5182`](https://github.com/dev-zetta/OpenArcanum/commit/1a7f5182b8852c157ec4a4ef2e40f5b8c330a754))

## 2019-06-14

- **Electron / AGate:** Integrated Lance networking and reorganized rendering and keyboard-control infrastructure. ([`232170ab`](https://github.com/dev-zetta/OpenArcanum/commit/232170ab5ee5cc31e8368cd6f3e793613339f571))

## 2019-06-12

- **Electron / AGate:** Reworked entity and component organization, IDs, player-selection logic and sector caching; revised client and server startup. ([`29b9d3b2`](https://github.com/dev-zetta/OpenArcanum/commit/29b9d3b2fbf621c3fecda85730136edbd34b0b1f))

## 2019-06-02

- **Electron / AGate:** Moved AGate into the @openarcanum/agate package, added Flow configuration and reorganized engine, components, prototypes and rendering code. ([`bccc3392`](https://github.com/dev-zetta/OpenArcanum/commit/bccc3392adfa2bfc1b3b550cc1eada4fd1dc65fd))

## 2018-11-26

- **Electron / AGate:** Added Realm database and model integration and entity-backed inventory examples; revised GUI, renderer and asset interfaces. ([`561b0349`](https://github.com/dev-zetta/OpenArcanum/commit/561b03499132a3d5a33227cd29601f1e387b3d07))
- **Asset database (historical data work; payload excluded):** Continued rule-table and schema cleanup, including factions, level names, item-effect descriptions and module MES tables. Historical converted-data work is excluded from public source publication. ([`5d8a8233`](https://github.com/dev-zetta/OpenArcanum/commit/5d8a8233990b515d7214a9368c6debe65674de3f), [`23729a04`](https://github.com/dev-zetta/OpenArcanum/commit/23729a04c886bf11271b615a227448519232229c))

## 2018-11-25

- **Asset database (historical data work; payload excluded):** Prepared schematic data and descriptions; reorganized rule-table names and added skill and spell tables. Historical converted-data work is excluded from public source publication. ([`5a484a00`](https://github.com/dev-zetta/OpenArcanum/commit/5a484a00a5b1f0add20167ae875024b2c1862ef3), [`25bb71f3`](https://github.com/dev-zetta/OpenArcanum/commit/25bb71f33e5f09e1e2064d568eabeb8d3c521753), [`103299de`](https://github.com/dev-zetta/OpenArcanum/commit/103299deae222e73c6cf23365b1e4ee1b2cfb2f5), [`dacf3482`](https://github.com/dev-zetta/OpenArcanum/commit/dacf34828f188010fb86d6701d3e72665e4fedca))

## 2018-11-24

- **Asset converter:** Added Windows-codepage decoding during reads. ([`26d6a42d`](https://github.com/dev-zetta/OpenArcanum/commit/26d6a42dc9475debe402a10ca5a7ffc9d32652d4))

## 2018-11-21

- **Asset database (historical data work; payload excluded):** Imported converted MES JSON, eight MP4 movies and interface graphics; renamed movie files. These historical game-derived data imports are excluded from public source publication. ([`6eecda2b`](https://github.com/dev-zetta/OpenArcanum/commit/6eecda2ba975e8ff0727b93c95b7ea96935bed3e), [`25a93084`](https://github.com/dev-zetta/OpenArcanum/commit/25a93084ee92be319ddf8cb33fa72531a71d8cce), [`c25befcb`](https://github.com/dev-zetta/OpenArcanum/commit/c25befcbdbada63681881e8f2bb8181341ec7d19), [`d378c47e`](https://github.com/dev-zetta/OpenArcanum/commit/d378c47e80866dd0c69598a889d2c65206ff3598))
- **Asset converter:** Enabled formatted JSON output. ([`00c14a66`](https://github.com/dev-zetta/OpenArcanum/commit/00c14a6613d719fb114bd83844c3300edcc64638))

## 2018-11-19

- **Asset converter:** Adjusted commit hooks and parser structure; added AI-parameter conversion. ([`893f3faf`](https://github.com/dev-zetta/OpenArcanum/commit/893f3faf9007e88c6c1599420c79347edc61b97e), [`b8001e93`](https://github.com/dev-zetta/OpenArcanum/commit/b8001e937dad2f7505be5f9f20c8e4a3757ceb3a), [`1a83136d`](https://github.com/dev-zetta/OpenArcanum/commit/1a83136d2cd473e2580cfb210d4f7183069f9cae), [`16c7f580`](https://github.com/dev-zetta/OpenArcanum/commit/16c7f5807d0fbab3b40a9a8141b91d656f6ea00f))

## 2018-11-18

- **Asset converter:** Added and refined newspaper, general-dialogue and anti-teleport data conversion; reorganized source resources and resolved paths; integrated branches and updated documentation and licensing. This day includes branch-only historical commits and a source-resource cherry-pick. ([`977d7137`](https://github.com/dev-zetta/OpenArcanum/commit/977d71370197e87a3a38d9c4c98e083a94b68125), [`43868171`](https://github.com/dev-zetta/OpenArcanum/commit/438681718417efa6b0b94976ff41c702e2a099e2), [`7e760f58`](https://github.com/dev-zetta/OpenArcanum/commit/7e760f58d6b951d529948c42212522923ef4210e), [`027c4f1e`](https://github.com/dev-zetta/OpenArcanum/commit/027c4f1ed196f43594ea659b346247ddc03a792e), [`e91039c1`](https://github.com/dev-zetta/OpenArcanum/commit/e91039c1e99a9de81a40029bb550bfafe7887387), [`43176c66`](https://github.com/dev-zetta/OpenArcanum/commit/43176c6606698f8dabf6192fb3a1f5d88bde47dd), [`d62865a1`](https://github.com/dev-zetta/OpenArcanum/commit/d62865a1e3dbbc92f73a5bf231a53b9ed019d05c), [`673bfda5`](https://github.com/dev-zetta/OpenArcanum/commit/673bfda565c79d4d5f7892143faa39514d396a03), [`ff9c9d67`](https://github.com/dev-zetta/OpenArcanum/commit/ff9c9d67e979fe1151eeab4527d887799b7e1211), [`8684ad4a`](https://github.com/dev-zetta/OpenArcanum/commit/8684ad4a314b998d57fa59026b9d09400e3fe233), [`18ac608a`](https://github.com/dev-zetta/OpenArcanum/commit/18ac608a407c993487486e77af9e9c2262ab57a2), [`19329a27`](https://github.com/dev-zetta/OpenArcanum/commit/19329a2797c832388e053d38fd36ef6dd9a5ac6f), [`d5bdc5b0`](https://github.com/dev-zetta/OpenArcanum/commit/d5bdc5b0912fa30917c8bfed354e56f51f3094d3), [`250ef30b`](https://github.com/dev-zetta/OpenArcanum/commit/250ef30bc0337c5c7ab3eab3c0618a76a5ce7d62), [`7bffd02c`](https://github.com/dev-zetta/OpenArcanum/commit/7bffd02c559351518bf890f86fd5449f08b15b66), [`dbc5a0d3`](https://github.com/dev-zetta/OpenArcanum/commit/dbc5a0d3bbe604f5453486537314fcef3b6db99d), [`a1f4564d`](https://github.com/dev-zetta/OpenArcanum/commit/a1f4564d9b207cf352be016ab986a5f508d6d903), [`a1e1816e`](https://github.com/dev-zetta/OpenArcanum/commit/a1e1816e791d4f6d7fe22a7349c5e7e43eb8e9ac), [`5d2f4644`](https://github.com/dev-zetta/OpenArcanum/commit/5d2f4644733704c341e163129184536e7963be17), [`3322a34c`](https://github.com/dev-zetta/OpenArcanum/commit/3322a34c6446b1b094910734f78c868861b7bc1d), [`bbe1cd32`](https://github.com/dev-zetta/OpenArcanum/commit/bbe1cd32b5532b5a15530bd2d75b36b8dcee2ca5))

## 2018-11-13

- **Electron / AGate:** Expanded UI prototypes with bottom panels, chat, debug and video windows; added Electron and integration helpers. ([`02b8c1e3`](https://github.com/dev-zetta/OpenArcanum/commit/02b8c1e3634591fb4f1c74907c919774416cd75e))

## 2018-11-12

- **Asset database (historical data work; payload excluded):** Created repository documentation and added its noncommercial license. Historical converted-data repository; its data is excluded from public source publication. ([`c22c3072`](https://github.com/dev-zetta/OpenArcanum/commit/c22c3072d45e04aabc9d1823231bbb95330cb137), [`4780c5ef`](https://github.com/dev-zetta/OpenArcanum/commit/4780c5ef9b6725c85e474aa66988f17833760062))

## 2018-11-05

- **Asset converter:** Reorganized the package and start script and renamed and upgraded package metadata. ([`78da6822`](https://github.com/dev-zetta/OpenArcanum/commit/78da682279ac91bd481ca6439ccb322652de0a71), [`7f50550c`](https://github.com/dev-zetta/OpenArcanum/commit/7f50550cb6c1d148b00fdada2e8231537150c29c))

## 2018-11-02

- **Asset converter:** Merged initial global-converter development into master. ([`4157ea2b`](https://github.com/dev-zetta/OpenArcanum/commit/4157ea2be506640d33fa114888e3f7cc73da3e2e))

## 2018-10-30

- **Electron / AGate:** Reworked GUI components into Ember pods and adjusted window integration. ([`540d849a`](https://github.com/dev-zetta/OpenArcanum/commit/540d849a0d4cf4a4cfc279f550881d40cfbb8cae))
- **Asset converter:** Fixed consolidated dialogue JSON output. ([`8424126a`](https://github.com/dev-zetta/OpenArcanum/commit/8424126abd293bc088e50d6487cebc656710b8c2))

## 2018-10-28

- **Electron / AGate:** Updated project dependencies and reorganized renderer, engine and GUI integration. ([`6c6df5e6`](https://github.com/dev-zetta/OpenArcanum/commit/6c6df5e6fbf18fabdee42e4cb024bd9d58319ab5))

## 2018-08-05

- **Asset converter:** Expanded spell parsing and general-dialogue parsing and documentation. ([`59c56dca`](https://github.com/dev-zetta/OpenArcanum/commit/59c56dca473bdea2aad48d11ea57d05e5a037702))

## 2018-04-08

- **Asset converter:** Added a spell data class and cost parsing, conversion resources and global spell-converter integration. This converts metadata rather than implementing spell gameplay. ([`c0fb7700`](https://github.com/dev-zetta/OpenArcanum/commit/c0fb770006380c84a1dd4b4d9a69c57b1ee76892), [`5a595a4e`](https://github.com/dev-zetta/OpenArcanum/commit/5a595a4ec5669e9395e9e155d10135e164cbfbd6), [`67d5da1a`](https://github.com/dev-zetta/OpenArcanum/commit/67d5da1a340569aba60fd95745a1838ef6850b7e))

## 2018-04-02

- **Asset converter:** Began SpellList data conversion. ([`70f33eb4`](https://github.com/dev-zetta/OpenArcanum/commit/70f33eb4c3dda66642d615eec3339543f9fa0314))

## 2018-03-29

- **Asset converter:** Adjusted file-processing ordering. ([`f3db8bb9`](https://github.com/dev-zetta/OpenArcanum/commit/f3db8bb9d8aa093be991ac966c11f69d3d7ba1a1))

## 2018-03-28

- **Asset converter:** Added modular global-converter organization. ([`581c9f55`](https://github.com/dev-zetta/OpenArcanum/commit/581c9f55dc871a38e3ff0eb3d5e8a335b11a8527))

## 2018-03-27

- **Asset converter:** Created the initial converter repository. ([`f725845b`](https://github.com/dev-zetta/OpenArcanum/commit/f725845b8d908166b3f6f6b70914c13fbf4ff97c))

## 2018-03-03

- **Electron / AGate:** Reorganized AGate, map, assets and shared utilities; added dice support. ([`16de1139`](https://github.com/dev-zetta/OpenArcanum/commit/16de1139bef172eeaada03a8e449ccc93d134523))

## 2018-02-27

- **Electron / AGate:** Added attack-selection and animation scaffolding, spatial indexing and a combat-system skeleton. This snapshot did not implement complete combat resolution. ([`1a06c603`](https://github.com/dev-zetta/OpenArcanum/commit/1a06c603c897d04332c36dcb8ef4618126ced244))

## 2018-02-24

- **Electron / AGate:** Added movement paths, NPC and AI evaluator foundations and waypoint actions. ([`b735947f`](https://github.com/dev-zetta/OpenArcanum/commit/b735947f5191a14aaec5d285e688bf7aadd2f136))

## 2018-02-19

- **Electron / AGate:** Reworked asset and entity foundations; added entity components, waypoint and pathfinding code. ([`000258d2`](https://github.com/dev-zetta/OpenArcanum/commit/000258d2e672a7fcf33c405c4e1eb211d48c5cdf))

## 2018-02-14

- **Electron / AGate:** Iterated on lighting, projection and entity rendering. ([`bcd2b4ab`](https://github.com/dev-zetta/OpenArcanum/commit/bcd2b4abec23fae1c8d5f175ac3e9d297196ffe8))

## 2018-02-11

- **Electron / AGate:** Revised scene, sprite and isometric rendering and introduced lighting helpers. ([`f2042cf0`](https://github.com/dev-zetta/OpenArcanum/commit/f2042cf0822f3c13948b4c935b89fb7b8d0f5acd))

## 2018-02-08

- **Electron / AGate:** Added book, map and schematic-window prototypes and GUI grouping and property controls. ([`13a3b1e0`](https://github.com/dev-zetta/OpenArcanum/commit/13a3b1e0f3243e0fa30d02b1a58449eadb9fc7f1))

## 2018-02-04

- **Electron / AGate:** Added character, dialogue, inventory and spell-window prototypes; extended GUI dragging and events. ([`c089d27f`](https://github.com/dev-zetta/OpenArcanum/commit/c089d27f4f89df25d043e8618bc7eb516f0fa308))

## 2018-01-28

- **Electron / AGate:** Added GUI management and initial button, checkbox, gauge, inventory, spinner, widget and window components. ([`9a77dda4`](https://github.com/dev-zetta/OpenArcanum/commit/9a77dda4d5197becfc9df799044f29e5a27a3c83))

## 2018-01-24

- **Electron / AGate:** Revised isometric rendering and added map, location, sector and worker infrastructure. ([`8a73259b`](https://github.com/dev-zetta/OpenArcanum/commit/8a73259b43860908d92059325d26561d8c7d69ad))

## 2018-01-15

- **Electron / AGate:** Introduced isometric plugin integration and reorganized client scene and sprite code. ([`424f2dce`](https://github.com/dev-zetta/OpenArcanum/commit/424f2dce4eed9c4a7075664e3551efcd3067e66b))

## 2018-01-06

- **Electron / AGate:** Added initial AGate client, server and asset code and Phaser-based rendering experiments. ([`0759f07e`](https://github.com/dev-zetta/OpenArcanum/commit/0759f07e360b2167ea09adb89a7ae20a3bf5e1c4))

## 2017-12-27

- **Electron / AGate:** Adjusted initial application, styling and build configuration. ([`019984b2`](https://github.com/dev-zetta/OpenArcanum/commit/019984b2afaf0be1e32b79ad0cd73751364503a3))

## 2017-12-23

- **Electron / AGate:** Generated the initial Ember CLI 2.18.0-beta.2 application scaffold. ([`9c29e40d`](https://github.com/dev-zetta/OpenArcanum/commit/9c29e40d075e61da1c9fda25381b94499e3ceaa1))
