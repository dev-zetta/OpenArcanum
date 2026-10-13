# OpenArcanum

An independent engine reimplementation of **Arcanum: Of Steamworks and Magick Obscura**, built with Electron, the AGate engine, Ember and PixiJS. Project-owned JavaScript has been migrated to **TypeScript 7** across the application, engine, converter, authored GUI, tooling and tests. Upstream libraries and generated compatibility files retain their JavaScript formats. Flow is no longer required.

**Work in progress. Active development resumed on October 11, 2026.** This repository continues the 2018 JavaScript rewrite of the original OpenArcanum / ArcanumAlive project, now migrated to TypeScript 7. It is a source-only publication; no complete playable release or end-to-end campaign compatibility is claimed.

## Current state

The current Electron, Ember and PixiJS toolchain can run the bundled [inventory workshop](examples/inventory-workshop/README.md) without retail assets. Launch it with `npm run start:workshop`. The owned room includes an animated character, a guide, three crates and two doors.

Inspect the first crate to take or return its token. The second holds a standalone key for the locked door and third crate. Take the key, use the door and retrieve the **Workshop keepsake**. Put the key away and both locks require it again. Take All moves the entire supported set atomically; an unsupported item rejects the whole batch.

Pick up the **Workshop pebble** at `(4, 7)` through its artwork or the Ground items panel. Talk to the **Workshop guide** at `(9, 8)`, accept **A closer look**, and show the carried pebble. Completion preserves it and grants **2,100 XP**, reaching **level 2** and granting one more Character Point.

The actor starts with five points. In **Character**, increase any of the eight base attributes for one point per increment, up to 20. Spend the five starting points, finish the quest and spend its new point. Attributes, journal and progression survive checkpoints. The folded derived preview shows the neutral profile's calculated values; combat, movement speed and weight enforcement remain unfinished. Other point purchases, equipment and stacks remain unfinished.

With compatible locally converted data, **Start local map** launches a private headless server and connects the desktop client to **Bates Mansion Lev 2**. The server validates click-to-walk commands against its own converted geometry and advances the controlled actor independently of rendering. Clicking a supported door makes the actor approach and toggle it; server snapshots update its collision and original open/closed artwork. **Save checkpoint** and **Load checkpoint** retain the actor's position and managed door states in one local slot. Supported containers can be approached and inspected using recovered original ownership; contents are sent privately to the controlling player. Floors, collision and objects align; recovered roofs hide above the indoor player, and static lighting uses original masks and ground-sampled character/prop colors while keeping fire effects bright. This small checkpoint is under active development; the original campaign remains unfinished.

| Area | Present in the source | Work remaining |
| --- | --- | --- |
| Application and rendering | Nine Bates Mansion sectors, 386 map entities and a controlled actor; recovered roof visibility and static mask lighting | Roof edge fading, light animation/shadows and original wall gradients, other maps and full visual fidelity. |
| User interface | Character, inventory, dialogue, map and other window code | Connect and test each interface against complete gameplay behavior. |
| Assets | Conversion code, loaders and a reproducible owned workshop with generated artwork | Restore a documented, complete conversion pipeline and validate its output against original game data. |
| Gameplay | Server-owned movement, pause/resume, door use, private inventory transfers, matching-key access, authored ground pickup/drop, one branching conversation, persistent quest journal, atomic XP/level rewards, eight base-attribute purchases and neutral derived previews; checkpoints for these supported states | Original movement costs, complete lock rules, NPC AI, combat, original dialogue/scripts/quests, character creation, other Character Point purchases, derived gameplay effects, equipment/stack/weight rules and complete campaign persistence. |
| Networking and tools | Versioned loopback commands/snapshots, actor ownership, replay rejection, read-only observers, an Electron-owned headless child and atomic local checkpoint storage | Multiple controlled players, campaign co-op, public hosting, complete lifecycle/platform validation and authoring workflows. |

## Direction

The renewed design is an **MMORPG-oriented, server-authoritative engine**. The first singleplayer foundation starts a local server and connects the normal client through a versioned protocol. Co-op and dedicated hosting will extend that same boundary. Private campaign co-op comes first; persistent community worlds and higher populations follow measured results. Windows, Linux and macOS clients, supported headless hosting and versioned mod APIs are targets.

Read the [game pitch](docs/GAME_PITCH.md) and [feature roadmap](docs/FEATURE_ROADMAP.md) for the roleplaying promise, 47 feature families, current gaps and acceptance milestones. The local server controls one actor's movement and narrow door and inventory interactions. Take, Take All and Put require fresh private inspection, supported whole Generic/standalone Key behavior and explicitly known actor ownership. [Key-authorized doors and containers](docs/KEYS.md) check actual possession before approach and on arrival; container inspection and each transfer check again. Access preserves the key and lock flag. Key access requires an explicit authored support declaration because the historical converter discarded original script references. Original Bates locks and unknown actor inventory remain intact.

Current checkpoints store position, managed door poses, verified ownership, supported ground placement, authored quest status and consistent owned character progression, including inventory gaps and a key-opened door after the key is put away. A fixed reachable-key chain constrains which locked-container contents can move; a self-locked key or inaccessible key cycle cannot grant access. Development saves are disposable; older-rule compatibility and migrations are not maintained. Complete character statistics, NPC simulation, original quests, RNG and world time still need persistence. A fresh host starts at the development spawn until **Load checkpoint** is selected. Lock picking, keyrings, party key sharing, equipment, stacks, junk piles, decay and original item scripts remain unfinished. [Ground pickup and dropping](docs/GROUND_ITEMS.md) currently support only the explicitly authored whole Generic pebble; the token, keepsake and key keep their prior rules. [Dialogue and quests](docs/DIALOGUE_QUESTS.md) currently support the bounded owned guide scenario. [Progression](docs/PROGRESSION.md) uses reviewed XP thresholds and level-up point awards. [Attribute purchases](docs/ATTRIBUTES.md) support the owned neutral-human profile and derived previews; race/background/equipment effects, other Character Point purchases, original DLG/scripts, complete rewards and party conversation remain ahead. Door poses switch directly to the committed frame; original opening animation, playable co-op and complete campaign saves remain ahead.

**Pause** and **Resume** control the local server, preserving movement midway
through a tile and freezing world artwork while keeping the interface responsive.
An idle paused session can save or load its checkpoint. Pause is a transient host
policy; it is not stored in the checkpoint, and future multiplayer pause rules
remain separate work.

The [reference-game oracle](docs/ORACLE.md) runs a separate local copy of the supplied original under Wine, captures evidence, compares matched screenshots and analyzes executable copies with Ghidra. It also documents conversion of a locally supplied manual into searchable HTML and Markdown. Tools, original content and generated evidence stay in ignored local storage.

## Game data

**The original game's assets are not included.** The bundled workshop needs no original game data. Running original content requires your own copy of Arcanum and locally converted data. This repository does not yet provide a complete, validated process that turns an installation of the original game into a playable OpenArcanum installation.

The `asset-db` directory retains authored TypeScript client GUI definitions; proprietary game archives, converted artwork, music, maps and other retail data are excluded from this source-only repository. The source license does not grant rights to the original game or its assets.

Put compatible converted data in **`local-data/`**, which is ignored by Git, or set `OPENARCANUM_DATA_PATH`. The current scene requires `archives/Bates Mansion Lev 2.zip`, `archives/Prototypes.zip`, `archives/Gfx.zip`, `archives/Gfx-tiles.zip`, GUI images/metadata, MES tables and `16086.json`. Original DAT files cannot be used directly. See [local data and scene controls](docs/DEVELOPMENT.md#local-data-and-optional-integrations) for details.

Historical converted maps lost roof cells and light artwork IDs. A [local recovery helper](docs/DEVELOPMENT.md#recover-roofs-and-static-light-metadata) restores those records from original extracted SEC files without changing the source archives. Recovered data remains private under `local-data/`.

The old converter also omitted container inventory lists and item parents.
[Inventory recovery notes](docs/INVENTORY_RECOVERY.md) document validated original
MOB ownership records, the local recovery tool, private inspection and the narrow
owned transfer/save scenario. Original equipment and complete inventory rules
remain unfinished.

[Private item names](docs/ITEM_DISPLAY.md) resolve permitted system descriptions
with identification-aware fallback. The owned token displays as **Workshop token**;
module-specific names, key names and complete examination remain unfinished.

## Repository layout

| Path | Purpose |
| --- | --- |
| `app/` | Ember application, components, templates and UI integration. |
| `ember-electron/` | Electron main/preload, local resource protocols and startup checks. |
| `@openarcanum/agate/` | Local AGate engine package: rendering, entities, resources and supporting systems. |
| `@openarcanum/asset-converter/` | Partial MES/dialogue-message, spell-metadata and rule-table conversion tools. |
| `@openarcanum/asset-db/scripts/` | Authored TypeScript client GUI definitions; builds into ignored `compiled-scripts/`. |
| `docs/` | Pitch, feature roadmap, reference workflow, development notes and history. |
| `scripts/oracle/` | Source-only local Wine/Ghidra bootstrap, reference harness and manual conversion. |
| `examples/inventory-workshop/` | Owned map, objects, generated artwork and deterministic module generator. |

See [DEVELOPMENT](docs/DEVELOPMENT.md) for development instructions, [HISTORY](docs/HISTORY.md) for the project timeline, [CHANGELOG](CHANGELOG.md) for changes, and [AUTHORS](AUTHORS.md) for credits.

## Development

Use **Node.js 24.11 or newer in the Node 24 LTS line** and npm 11 or newer. The root lockfile covers the application, AGate and converter npm workspaces; separate installs inside the packages are unnecessary.

```sh
npm ci
npm run typecheck   # strict production checks plus separate fixture checks
npm run build       # check types; build engine, UI, host, converter and GUI
npm start           # rebuild and open Electron
npm run start:workshop # rebuild and run the owned example; no retail assets
# Or, after building:
npm run start:built

npm test            # engine, converter and local protocol regression tests
npm run test:ui     # QUnit UI tests inside Electron; builds development UI
npm run build       # restore production UI after UI tests
npm run smoke       # hidden Electron startup check; needs a graphical display
npm run smoke:renderer # synthetic atlas/shader pixel checks in Electron/WebGL
npm run smoke:game -- --show # scene, movement, doors, checkpoint save/load, containers and native input
npm run smoke:game -- --show --game-lifecycle # also check session/reload lifecycle
npm run smoke:workshop -- --show --game-lifecycle # owned module, private item inspection and native input
# Or run every validation step in the right order:
npm run check
```

The current stack is TypeScript 7.0.2, Electron 44.7, Ember/Ember CLI 7.3, PixiJS 8.22 and Vite 8.3. Babel remains on version 7 to satisfy the Ember build plugins. The [TypeScript migration notes](docs/DEVELOPMENT.md#typescript) describe strict production checking, deliberately malformed test fixtures, generated runtime output and upstream exceptions. Exact versions are pinned in [package.json](package.json) and [package-lock.json](package-lock.json).

The authority bundle also runs directly in Node without Electron or a display:

```sh
node @openarcanum/agate/dist/authority.cjs --data-path ./local-data \
  --map-id 'Bates Mansion Lev 2' --port 0
```

This development host always binds to `127.0.0.1`; port `0` selects a free port. See [local authority commands and protocol](docs/DEVELOPMENT.md#local-authority-checkpoint) for private session credentials, headless checks and current limitations.

A fresh source checkout can launch the workshop with `npm run start:workshop`; its checkpoint lives in ignored `local-data/saves/inventory-workshop.json`. Normal `npm start` selects the original-content scene and shows its data requirements when assets are missing. Set `OPENARCANUM_DATA_PATH` or edit `config.json` for that scene. Runtime paths resolve against the project directory, and the included GUI scripts use their own configured path. Finding the expected files does not establish that their contents are valid or that the campaign is playable.

See [DEVELOPMENT](docs/DEVELOPMENT.md) for setup, tests, known gameplay gaps and Electron compatibility mode, and [DEPENDENCIES](docs/DEPENDENCIES.md) for the upgrade decisions and remaining upstream advisories. The optional historical YouTube integration reads environment credentials; see `.env.example`.

The next implementation gates are reproducible content/reference scenarios, completing and hardening the local authority milestone, and a complete inventory/dialogue/encounter/save/travel slice. Preserve the Bates rendering regression while adding game rules behind the server boundary.

## History and archival links

The project began with an Object Pascal / DirectDraw prototype in late 2008, followed by C++ / Qt / Lua / OpenGL work in 2009. Development resumed in 2017; the JavaScript rewrite was publicly described in January 2018. The [author's retrospective](https://forums.arcanumclub.org/topic/11952-the-openarcanum-continues-after-5-year-break/) documents the earlier stages and related ArcanumAlive projects.

### Articles and development posts

| Date | Article |
| --- | --- |
| 2010-10-14 | [A few interesting things — Free Gamer](https://freegamer.blogspot.com/2010/10/few-interesting-things.html?m=0): independent coverage of ArcanumAlive / OpenArcanum and its Linux port. |
| 2011-05-14 | [Arcanum Co-Op, Engine Conversions, and more! — GOG](https://www.gog.com/forum/arcanum_of_steamworks_and_magick_obscura/arcanum_co_op_engine_conversions_and_more/page1): contemporary community overview. |
| 2017-07-14 | [The OpenArcanum continues after 5 year break — Arcanum Club](https://forums.arcanumclub.org/topic/11952-the-openarcanum-continues-after-5-year-break/): author retrospective and return to development. |
| 2018-01-29 | [OpenArcanum Project - This year! — Terra-Arcanum](https://terra-arcanum.com/forums/threads/openarcanum-project-this-year.23213/): JavaScript rewrite announcement, updated February 4. |
| 2018-11-21 | [OpenArcanum - A new UI on the way — Arcanum Club](https://forums.arcanumclub.org/topic/12031-openarcanum-a-new-ui-on-the-way/): second UI iteration. |

### Historical demos

| Date / date basis | Video |
| --- | --- |
| 2009-06-12, title | [ArcanumAlive Preview - 12.6.2009](https://www.youtube.com/watch?v=40OmKwXGO28) |
| July 2009, author timeline | [MultiArcanum - Preview video 1](https://www.youtube.com/watch?v=HTpTD2GOHUM) — related multiplayer campaign work. |
| 2009-11-29, title | [OpenArcanum - Preview 29.11.2009](https://www.youtube.com/watch?v=Vw9Pwz13QjA) |
| August 2012, author timeline | [Arcanum Multiplayer - Testing new features of MatchMaker2](https://www.youtube.com/watch?v=p_jJqyIzcUA) — related multiplayer tooling. |
| 2018-02-02, YouTube metadata | [OpenArcanum - Web UI tech preview](https://www.youtube.com/watch?v=JR0XN1dRaoU) |
| 2018-11-14, YouTube metadata | [OpenArcanum - UI v2 Preview](https://www.youtube.com/watch?v=y4hRS9s3w1Q) |

The early video links and titles come from the author's retrospective; their upload dates were not independently verified. The 2018 titles, dates and ArcanumAlive uploader name were verified through indexed YouTube metadata. Playback was not checked during the October 2026 documentation review.

### Archival fundraising and websites

The following pages are historical references, not a current fundraising announcement:

- [FundRazr: OpenArcanum - A steampunk RPG game revival](https://fundrazr.com/campaigns/21KG59), credited to Libor Gabriel Max, with a [February 12, 2018 development update](https://fundrazr.com/stories/aDCXb8).
- [Gabriel Max's OpenArcanum Patreon page](https://www.patreon.com/gabriel_max/about), historically linked as [patreon.com/libor_max](https://www.patreon.com/libor_max).
- An Indiegogo campaign was linked in the [January 2018 announcement](https://terra-arcanum.com/forums/threads/openarcanum-project-this-year.23213/); its full destination has not been recovered.
- [ArcanumAlive website](http://arcanum.game-alive.com/), [original development forum](http://arcanum.game-alive.com/forums/viewforum.php?f=19), [Facebook page](https://www.facebook.com/ArcanumAlive/) and related [restoration of Sierra's Arcanum website](http://arcanum1.game-alive.com/).

Some historical pages may require a browser challenge or be inaccessible. Old feature targets and delivery estimates describe their time of publication.

## License and credits

Project-authored source is available under the **GNU General Public License, version 3 or any later version** (`GPL-3.0-or-later`); see [LICENSE](LICENSE). Third-party components retain their own licenses and notices; see [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

OpenArcanum was created by Gabriel Max, historically posting as Crypton within ArcanumAlive. Additional contributors and upstream acknowledgments are listed in [AUTHORS](AUTHORS.md). *Arcanum: Of Steamworks and Magick Obscura* and its original content belong to their respective owners.
