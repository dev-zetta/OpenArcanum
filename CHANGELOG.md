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
- Documented known implementation gaps and the first offline playable checkpoint.
  A successful development build does not establish a playable game release.

## 2019-12-06

- **Electron / AGate:** Reworked AI evaluators and actions and client controls and startup; revised entities, world and render updates and exported distribution files. ([`4ee0f24f`](https://github.com/dev-zetta/OpenArcanum/commit/4ee0f24f4dcb0d4c9f808783776c4aa10b7fa5ce))

## 2019-07-12

- **Electron / AGate:** Revised server join and request handling and client command evaluation; reorganized render filters and shaders and entity-manager startup. ([`bc6810b2`](https://github.com/dev-zetta/OpenArcanum/commit/bc6810b295035d8428c95a3f27e793d00fb69f1d))

## 2019-07-03

- **Electron / AGate:** Revised frame synchronization, movement and waypoints, entity updates, serialization and sprite and scene rendering. ([`4d5114b5`](https://github.com/dev-zetta/OpenArcanum/commit/4d5114b5acfe68028360114b52860a9947db5b73))

## 2019-06-28

- **Electron / AGate:** Reworked entity management around components, pools, events and messaging. ([`1de1ac3e`](https://github.com/dev-zetta/OpenArcanum/commit/1de1ac3eac1578d371fba625e5f39b3f3b858d61))

## 2019-06-23

- **Electron / AGate:** Introduced PIXI integration and revised Lance-derived client, server and network code. ([`9c7e4436`](https://github.com/dev-zetta/OpenArcanum/commit/9c7e443610701f4131f39813087b2123cc8d7782))

## 2019-06-14

- **Electron / AGate:** Integrated Lance networking and reorganized rendering and keyboard-control infrastructure. ([`7fa285a0`](https://github.com/dev-zetta/OpenArcanum/commit/7fa285a0262a6900c5d3c163dacb8569a3bd7f0a))

## 2019-06-12

- **Electron / AGate:** Reworked entity and component organization, IDs, player-selection logic and sector caching; revised client and server startup. ([`10f86c98`](https://github.com/dev-zetta/OpenArcanum/commit/10f86c987f430ab4e24305f9db87c4dfa9b37414))

## 2019-06-02

- **Electron / AGate:** Moved AGate into the @openarcanum/agate package, added Flow configuration and reorganized engine, components, prototypes and rendering code. ([`53c97b6a`](https://github.com/dev-zetta/OpenArcanum/commit/53c97b6abba4503e2bee0cf280df46a9fdd77872))

## 2018-11-26

- **Electron / AGate:** Added Realm database and model integration and entity-backed inventory examples; revised GUI, renderer and asset interfaces. ([`81b5de3a`](https://github.com/dev-zetta/OpenArcanum/commit/81b5de3a56d33d6ce7e5a6b845f63c34fe4ccbb2))
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

- **Electron / AGate:** Expanded UI prototypes with bottom panels, chat, debug and video windows; added Electron and integration helpers. ([`d72adcdf`](https://github.com/dev-zetta/OpenArcanum/commit/d72adcdf5e8cd1826feed100db8d8a65093cc6fa))

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
