# OpenArcanum

An independent engine reimplementation of **Arcanum: Of Steamworks and Magick Obscura**, built with Electron, the AGate engine, Ember and PixiJS. The source is primarily **JavaScript with Flow annotations**.

**Work in progress. Active development resumed on October 11, 2026.** This repository preserves the JavaScript generation of the original OpenArcanum / ArcanumAlive project and provides a starting point for its continued development. It is a source-only publication; no complete playable release or end-to-end campaign compatibility is claimed.

## Current state

The source includes an Electron application shell, an Ember user interface, AGate rendering and entity infrastructure, asset-conversion tools, and client UI scripts. Historical demos show earlier builds of this work. The published tree still needs dependency recovery, reproducible build instructions and runtime validation.

| Area | Present in the source | Work remaining |
| --- | --- | --- |
| Application and rendering | Electron/Ember integration, PixiJS-based engine code, scene and entity infrastructure | Restore and validate a clean installation, launch and rendering path. |
| User interface | Character, inventory, dialogue, map and other window code | Connect and test each interface against complete gameplay behavior. |
| Assets | Conversion code and loaders for converted formats | Restore a documented, complete conversion pipeline and validate its output against original game data. |
| Gameplay | Models, scripts and partial systems | Complete and verify movement, combat, AI, dialogue/quests, progression and persistence together. |
| Networking and tools | Networking dependencies and development/editor infrastructure | Establish working, tested multiplayer and authoring workflows. |

Cross-platform play, co-op, extensive modding, improved visual effects, physics and an integrated editor were historical project goals. Their appearance in old announcements does not mean they are finished in this source tree.

## Game data

**The original game's assets are not included.** A usable runtime will require your own copy of Arcanum and locally converted data. This repository does not yet provide a complete, validated process that turns an installation of the original game into a playable OpenArcanum installation.

The `asset-db` directory retains client scripts; proprietary game archives, converted artwork, music, maps and other retail data are excluded from this source-only repository. The source license does not grant rights to the original game or its assets.

## Repository layout

| Path | Purpose |
| --- | --- |
| `app/` | Ember application, components, templates and UI integration. |
| `ember-electron/` | Electron entry points and packaging configuration. |
| `@openarcanum/agate/` | Local AGate engine package: rendering, entities, resources and supporting systems. |
| `@openarcanum/asset-converter/` | Partial MES/dialogue-message, spell-metadata and rule-table conversion tools. |
| `@openarcanum/asset-db/scripts/` | Retained client UI scripts; converted retail data must be supplied locally. |
| `docs/` | Development notes and project history. |

See [DEVELOPMENT](docs/DEVELOPMENT.md) for recovery work, [HISTORY](docs/HISTORY.md) for the project timeline, [CHANGELOG](CHANGELOG.md) for changes, and [AUTHORS](AUTHORS.md) for credits.

## Development and recovery

The preserved manifests target a legacy stack: **Node.js 10, Electron 8, Ember 3 and PixiJS 5**. Dependencies include native modules, local packages and Git-hosted packages. Installing the latest Node.js does not by itself make this tree compatible with a current toolchain.

The following commands describe the historical package workflow. **They are an unvalidated recovery reference, not a tested quickstart.** A fresh installation, build and launch of the source-only publication have not been established.

```sh
# At the repository root:
npm install

# Install dependencies of the local engine package as well:
cd @openarcanum/agate
npm install
cd ../..

# Root package scripts:
npm start       # ember electron
npm run build   # ember build
npm test        # ember test
```

These commands also require compatible dependency versions and locally converted assets. Set `OPENARCANUM_DATA_PATH` or edit `config.json`; paths resolve against the project directory. The optional YouTube integration reads environment credentials; see `.env.example`. The old Ember-generated tests do not establish game correctness. Follow [DEVELOPMENT](docs/DEVELOPMENT.md) for the current state and record successful environments and reproduction steps when contributing.

Useful early contributions include making installation reproducible, completing portable configuration, validating converters, documenting data requirements and establishing a small playable scene before extending gameplay.

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
