# Dependency upgrade — October 11, 2026

The JavaScript/Electron project now uses a single npm-workspace install and a
root lockfile. Versions were checked against npm's stable release metadata and
the upstream Ember and Electron releases during this upgrade.

| Area | Current version |
| --- | --- |
| Development runtime | Node 24 LTS, >=24.11.0; npm >=11 |
| Electron | 44.7.0 |
| Ember / Ember CLI | 7.3.0 |
| Ember Data legacy model/store packages / WarpDrive | 5.9.1 |
| Vite | 8.3.4 |
| Embroider core / compat / Vite plugin | 4.6.9 / 4.1.27 / 1.7.15 |
| PixiJS / Viewport / filters | 8.22.0 / 6.0.3 / 6.1.5 |
| Socket.IO / client / MessagePack parser | 4.8.4 / 4.8.4 / 3.0.2 |
| esbuild / Sass | 0.28.2 / 1.105.1 |
| Babel core and Flow strip plugin | 7.29.7 |
| Converter iconv-lite | 0.7.3 |

Exact direct versions and transitive integrity hashes are committed in the root
manifest and lockfile. Do not use `--legacy-peer-deps` or `--force` to bypass peer
conflicts. The official [Ember 7.3 announcement](https://blog.emberjs.com/ember-released-7-3/)
and [Electron 44.7 release](https://releases.electronjs.org/release/v44.7.0)
provide upstream context.

## Compatibility choices

Babel 8.0.7 is available, but the current `ember-cli-babel` 8.3.2 and
`@rollup/plugin-babel` 7.1.0 peer dependencies still require Babel 7. This build
uses the latest stable Babel 7 core/plugin versions and runtime 7.29.10. Moving
to Babel 8 requires upstream support rather than ignoring those peer contracts.

AGate's Flow annotations are removed before bundling. Type-only class fields
must not become emitted fields: some engine fields share names with getters.
ESM dependencies are bundled into the Node-compatible engine entry; workerpool
remains external so its worker files keep working. This is compilation and
regression coverage, not a complete Flow type-checking migration.

The existing Ember application remains in place. Abandoned Flexi/layout,
Bootstrap, toggle, resize, audio, scheduler and related addons were replaced
with maintained library imports or small native implementations. GUI scripts
load through the real local adapter rather than a Mirage mock server. Dynamic
widget components resolve through a fixed imported class registry. Current
Ember Data legacy APIs are retained to avoid a separate model rewrite.

The engine now uses Pixi 8 asynchronous initialization, texture sources, atlas
metadata, Viewport events and filter resources. Synthetic Electron/WebGL checks
verify actual filtered sprite pixels, atlas pixels and a zero GL error result.

The retired Ember Electron / electron-compile / Forge 5 launch pipeline is
replaced by direct Electron main/preload scripts. Unused native dependencies,
old Realm rebuild commands and Git-branch dependencies have been removed.
This covers the active `AGate.js` import graph. Dormant physics, dice,
experimental serialization, PSON and historical Google integration modules remain
as source references; they are not installed or tested as standalone features.
Reactivating them requires reviewing their APIs and dependencies explicitly.
See [DEVELOPMENT](DEVELOPMENT.md) for the explicit Node-enabled compatibility
mode and its remaining IPC work.

## Upstream audit limitations

The build-tool dependency tree still includes vulnerable `braces` and
`sprintf-js` releases. Their advisories report no patched version at the time
of this upgrade. Many audit entries are packages affected by these same leaf
dependencies, rather than separate flaws in each framework package:

- [braces: deeply nested pattern denial of service](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- [sprintf-js: unbounded precision denial of service](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

The affected packages are development/build dependencies in the lockfile. Avoid
feeding untrusted patterns into these tools. Do not use `npm audit fix --force`:
its proposed framework downgrades undo this migration and do not establish a
working or supported application.

Old `tmp` versions used by `can-symlink` and `external-editor` are overridden to
the compatible patched 0.2.7 release. Their temporary-name/file paths were checked
against the new API, then the project build and tests were rerun. See the
[temporary-file advisory](https://github.com/advisories/GHSA-ph9p-34f9-6g65).

Run `npm audit` to refresh the report. New releases or advisories can change
these findings; a clean audit is not claimed.

After the temporary-file overrides and required GUI data integration, the
verified lock reports 40 affected development packages (31 moderate, 9 high)
cascading from those two remaining leaf dependencies. `npm audit --omit=dev`
reports zero findings for the production install; that classification is not
a security audit of the bundled desktop application.
