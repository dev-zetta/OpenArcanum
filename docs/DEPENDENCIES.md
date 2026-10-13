# Toolchain and dependency upgrade — October 13, 2026

The TypeScript/Electron project uses a single npm-workspace install and a root
lockfile. Runtime/build dependency versions were checked against npm's stable
release metadata and upstream Ember/Electron releases during the October 11
upgrade. The October 13 migration added TypeScript 7 across owned source.

| Area | Current version |
| --- | --- |
| Development runtime | Node 24 LTS, >=24.11.0; npm >=11 |
| TypeScript native compiler | 7.0.2 |
| Electron | 44.7.0 |
| Ember / Ember CLI | 7.3.0 |
| Ember Data legacy model/store packages / WarpDrive | 5.9.1 |
| Vite | 8.3.4 |
| Embroider core / compat / Vite plugin | 4.6.9 / 4.1.27 / 1.7.15 |
| PixiJS / Viewport / filters | 8.22.0 / 6.0.3 / 6.1.5 |
| Socket.IO / client / MessagePack parser | 4.8.4 / 4.8.4 / 3.0.2 |
| esbuild / Sass | 0.28.2 / 1.105.1 |
| Babel core / TypeScript syntax transform | 7.29.7 / 7.29.9 |
| Converter iconv-lite | 0.7.3 |

Exact direct versions and transitive integrity hashes are committed in the root
manifest and lockfile. Do not use `--legacy-peer-deps` or `--force` to bypass peer
conflicts. The official [Ember 7.3 announcement](https://blog.emberjs.com/ember-released-7-3/)
and [Electron 44.7 release](https://releases.electronjs.org/release/v44.7.0)
provide upstream context.

## Compatibility choices

Babel 8.0.7 was available during the October 11 review, but `ember-cli-babel`
8.3.2 and `@rollup/plugin-babel` 7.1.0 require Babel 7. The build retains compatible
Babel 7 plugins and runtime 7.29.10. Moving to Babel 8 requires upstream support
rather than ignoring those peer contracts.

The native TypeScript 7 compiler checks owned production source with strict
settings. esbuild bundles the engine; Babel removes TypeScript syntax while
preserving Ember decorators for Vite. Syntax transformation does not replace
the compiler checks. Type-only class fields use `declare` where emitting a field
would shadow an existing getter. ESM dependencies are bundled into the
Node-compatible engine entry; workerpool remains external so its worker files
keep working. The [migration notes](DEVELOPMENT.md#typescript) explain separate
adversarial test configurations and upstream/generated JavaScript exceptions.

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
replaced by checked `.cts` main/preload sources compiled to `.cjs` and native
Node 24 launch scripts. Unused native dependencies,
old Realm rebuild commands and Git-branch dependencies have been removed.
Owned engine modules, including legacy physics, dice and serialization, now
participate in strict TypeScript checking. Upstream PSON retains its source
format. Dormant multiplayer, Realm, Google services and modal-window helpers
have [explicit provider contracts](LEGACY_ADAPTERS.md); their SDKs and unfinished
services are not enabled by the migration. Reactivating them requires API,
dependency and runtime validation.
See [DEVELOPMENT](DEVELOPMENT.md) for the explicit Node-enabled compatibility
mode and its remaining IPC work.

## Upstream audit limitations

The October 11 build-tool audit included vulnerable `braces` and `sprintf-js`
releases. Their advisories reported no patched version at the time of that
upgrade. Many audit entries were packages affected by these same leaf
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
October 11 report counted 40 affected development packages (31 moderate, 9 high)
cascading from those two leaf dependencies. At that point `npm audit --omit=dev`
reported zero findings for the production install. These are historical results,
not a refreshed audit of the TypeScript migration or a security audit of the
bundled desktop application.
