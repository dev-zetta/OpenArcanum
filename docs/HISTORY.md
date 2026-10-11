# Project history and source provenance

OpenArcanum is Gabriel Max's Arcanum engine reimplementation within the
ArcanumAlive project. The author's retrospective traces an Object Pascal /
DirectDraw prototype to late 2008, followed by C++ / Qt / Lua / OpenGL work in
2009. Development returned in 2017; the JavaScript rewrite was publicly described
in January 2018. See the [README's archival links](../README.md#history-and-archival-links)
for contemporary posts, funding pages and videos.

The early C++ project is a separate historical codebase and is not included in
this Electron repository. The newer unrelated Unity project with the same name
is not part of this source history.

## October 2026 publication

Active development resumed on **October 11, 2026**. The recovered Electron
working tree included changes beyond its last December 2019 commit; the exact
development dates of those files cannot be reconstructed from copied timestamps.
They are published as a recovered working-tree snapshot rather than backdated
as completed work on an invented historical day.

Three first-party repositories were imported into this source-only monorepo:

| History | Imported commits | Historical branch references |
| --- | --- | --- |
| Electron / AGate application | 26 | Main descends from the former `pixi` branch; `archive/electron-master` preserves the older master reference. |
| Asset database | 12 | `archive/asset-db/master`; retail-derived payloads are excluded. |
| Asset converter | 39 | `archive/asset-converter/master`, `archive/asset-converter/dev`, `archive/asset-converter/GlobalConverter`. |

All 77 historical commits are retained, including commits whose asset-only
changes become empty after filtering. The GlobalConverter branch contains six
commits not reachable from the old converter master; its branch is preserved.
Two current integration commits join the separate histories before the recovered
working-tree snapshot.

## Identity, attribution and filtering

All imported author and committer fields were normalized to the maintainer's
current configured identity, **Gabriel Max <dev@zetta.app>**. Original author and
committer timestamps were preserved. Contributor records are acknowledged in
[AUTHORS](../AUTHORS.md) and `Historical-Author` trailers; copyright and
third-party notices remain applicable.

Commit hashes necessarily changed. The changelog links the rewritten canonical
commits. Original Git directories, separate staged/unstaged patches and source
copies were retained privately before the publication checkout was created.
The copied originals were not rewritten or cleaned in place.

The filtered history excludes original/converted game content, fonts, movies,
archives, generated application bundles, local caches, editor state and dependency
directories. A hard-coded OAuth credential was removed from all revisions; the
current optional integration reads explicitly supplied environment variables.
The authored GUI scripts remain without the old extracted-item fixture.

This filtering makes historical snapshots suitable for source publication; it
does not make every old commit a self-contained reproducible game build.
Historical asset-database import milestones are described in the changelog even
though their payloads are deliberately absent.

## Changelog date policy

[CHANGELOG](../CHANGELOG.md) groups all historical commits by their **authored
timestamp converted to Europe/Prague**. A commit-free date has no entry. These
are recorded snapshot dates, not a claim that every change was written that day.
Summaries are retrospective descriptions of commit subjects, changed paths and
selected diffs. “Prototype,” “scaffold” and “refactor” do not imply finished game
behavior or independent runtime verification.
