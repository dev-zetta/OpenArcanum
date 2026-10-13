# Electron shell

The desktop source entry point is `ember-electron/main.cts`; TypeScript 7 emits
`dist-electron/main.cjs`. It uses Electron directly;
the former Ember Electron, Electron Compile, and Forge 5 launch chain is removed.
The root dependency is Electron 44.7.0, the stable release verified on 2026-10-11
against [Electron's release listing](https://releases.electronjs.org/release/v44.7.0).

Run from the repository root:

```sh
npm ci
npm start
```

`npm start` checks owned source and builds the engine, Ember UI, Electron host,
converter and authored GUI before launching. `npm run build:desktop` rebuilds
only the host. To launch an existing build with Node 24, use
`node scripts/electron-launch.cts`; append `--devtools`
to open Chromium's developer tools. A normal launch opens a 1280 by 900 window.

The built UI is served from `dist` at `serve://app/`. The `asset://` protocol
serves converted local files beneath the `dataPath` resolved by
`config/project.cts`; set `OPENARCANUM_DATA_PATH` to select another local directory.
Relative paths in the configuration resolve from the repository root. Original
Arcanum archives still need conversion into the layout understood by this
prototype; selecting a game installation is not an import operation.

`npm run build:config` generates conventional `config/*.js` files and the Ember
build entry from checked TypeScript sources. These compatibility files are
ignored; edit `.cts` configuration and `ember-cli-build.mts`. Authored GUI sources
compile separately into `@openarcanum/asset-db/compiled-scripts/`.

Protocol paths cannot escape their roots through traversal or symlinks. Asset
lookups accept unambiguous case-insensitive matches to accommodate Windows asset
names and Chromium's URL host normalization. Missing assets return HTTP 404.
Only extensionless UI history routes fall back to `dist/index.html`.

## Engine compatibility

`preload.cts` supplies `requireNode` using Node's `createRequire` rooted at this
repository. Existing calls such as `requireNode('@openarcanum/agate')` therefore
load the workspace package built by the root build. The preload also exposes
resolved runtime configuration as `window.openArcanumDesktop.config`.

The renderer intentionally retains Node integration, disables context isolation
and Chromium's renderer sandbox, and shares its JavaScript environment with the
engine. The existing engine requires Node modules synchronously, exports class
constructors, and accesses the DOM; that API cannot be passed intact through
Electron's `contextBridge`. Replacing it with isolated IPC services requires a
separate engine refactor. This shell is suitable for trusted local application
code and converted data, and is not a hardened renderer for untrusted content.

Web security remains enabled. External window creation, webviews, navigation
outside the application URL, and other permission requests are blocked. These
limits do not remove Node privileges from the renderer. Recording uses the
current `getDisplayMedia` API: only the main application frame can request video
of its own application window, following a user gesture. Microphone and system
audio are not granted. The smoke check does not start recording. Deprecated
engine modal helpers require an explicitly configured host provider; see
[legacy adapters](../docs/LEGACY_ADAPTERS.md). Their presence does not enable the
old modal workflow in the playable game.

## Renderer smoke check

After building, run:

```sh
node scripts/electron-launch.cts --smoke --smoke-timeout=15000 --smoke-report=/tmp/openarcanum-smoke.json
node --test ember-electron/protocol-files.test.cts
```

The smoke run loads the actual built Ember application in a hidden window and
waits for its `[data-app-ready]` marker. It reports the optional
`[data-assets-state]` marker, the presence of AGate, uncaught renderer/main errors,
renderer console messages, and failed local protocol requests. The explicit
missing-data application screen can pass; game simulation and original campaign
completeness are not covered by this check. Renderer errors, process crashes,
load failures, and readiness timeouts produce exit code 1. The machine must have
a working graphical display (or an externally configured virtual display).

The result is printed as one `OPENARCANUM_SMOKE` JSON line, optionally saved to
the report file. A temporary Electron profile prevents the smoke check from
depending on a developer's existing browser storage. `test-main.cts` remains a
small compatibility entry point that enables this same smoke mode.

## Ember/QUnit tests

`npm run test:ui` builds the development UI (including `tests/index.html`) and
launches `node scripts/electron-launch.cts --ui-test`. This mode loads the real
QUnit suite at `serve://app/tests/index.html` and waits for completion rather than
the application readiness marker. The test helper registers the actual QUnit
instance through `window.openArcanumDesktop.attachQUnit(QUnit)` before starting.
The preload records assertion failures and reports QUnit's final counts.

Use `--ui-test-timeout=60000` to change the timeout and
`--ui-test-report=/tmp/openarcanum-ui-tests.json` to save the JSON report. The
`OPENARCANUM_UI_TEST` result has exit code 1 for failed assertions, empty suites,
unhandled errors, and timeouts. Both automated modes disable recording.

Protocol handling follows Electron's current
[protocol API](https://www.electronjs.org/docs/latest/api/protocol).
