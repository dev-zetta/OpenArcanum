import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, net, protocol, session, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { resolveProtocolFile, type ProtocolFileOptions } from './protocol-files.cjs'
import { LocalServerHost, validateInitialScriptFlags } from './local-server.cjs'
import { LocalSessionController } from './local-session.cjs'
import { errorMessage, errorStack, type ProjectConfig } from './desktop-contracts.cjs'

interface ErrorEntry { kind: string; message: string; stack?: string }
interface FailedRequest { url: string; status?: number; message: string }
interface ConsoleMessage { level: number | string; message: string; line: number; source: string }
interface RendererReport {
  qunit?: { total: number; failed: number; testCounts?: { total: number } | null }
  [detail: string]: unknown
}
interface SmokeResult extends RendererReport { ok?: boolean; error?: string; cleanupError?: string }
interface SmokeOptions { timeout?: number; testInput?: boolean; moduleId?: string; checkpointPath?: string }
interface SmokeModule {
  runScriptSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runGameSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runWorkshopSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runDoorSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runCheckpointSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runContainerSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runPauseSmoke?: (contents: WebContents, options: SmokeOptions) => Promise<SmokeResult>
  runLocalSessionSmoke?: (contents: WebContents) => Promise<SmokeResult>
}

// Diagnostic harnesses intentionally stay executable CommonJS and consume only
// WebContents plus these small options; gameplay remains in the typed engine.
function smokeModule(name: string): SmokeModule {
  return require(path.join(projectRoot, 'ember-electron', `${name}-smoke.cts`)) as SmokeModule
}

const projectRoot = path.resolve(__dirname, '..')
const projectConfig = require(path.join(projectRoot, 'config', 'project.js')) as () => ProjectConfig
const config = projectConfig()
const uiRoot = path.join(projectRoot, 'dist')
const appUrl = 'serve://app/'
const smoke = process.argv.includes('--smoke')
const uiTest = process.argv.includes('--ui-test')
// The current suite has 86 application cases plus Ember's onerror validation.
// Missing test discovery must fail even when QUnit's own validation passes.
const minimumUiTestCount = 87
const gameSmoke = process.argv.includes('--smoke-game')
const scriptSmoke = gameSmoke && process.argv.includes('--smoke-scripts')
const automated = smoke || uiTest || gameSmoke
const loadUrl = uiTest ? `${appUrl}tests/index.html` : appUrl
const option = (name: string): string | null => {
  const prefix = `${name}=`
  const argument = process.argv.find(value => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}
// The complete native Workshop loop includes serial travel, inventory, quest,
// checkpoint and host-lifecycle checks and takes over two minutes at 30 FPS.
const defaultTimeout = gameSmoke ? (scriptSmoke ? 120000 : 180000) : uiTest ? 60000 : 15000
const configuredTimeout = Number(option('--game-smoke-timeout') || option('--ui-test-timeout') || option('--smoke-timeout') || defaultTimeout)
const smokeTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : defaultTimeout
const smokeReport = option('--game-smoke-report') || option('--ui-test-report') || option('--smoke-report')
const errors: ErrorEntry[] = []
const messages: ConsoleMessage[] = []
const failedRequests: FailedRequest[] = []
let mainWindow: BrowserWindow | null = null
let smokeFinished = false
let smokeTimer: ReturnType<typeof setTimeout> | undefined
let smokeSettleTimer: ReturnType<typeof setTimeout> | undefined
let gameSmokeStarted = false
let quitting = false
let quitReady = false
// Automated scene checks get their own slot and never replace a user's save.
const checkpointFixture = gameSmoke ? fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-checkpoint-smoke-')) : null
// A private fixture may initialize original global flags for this bounded
// reference check. Ordinary startup never reads this argument or exposes it.
const scriptFlagsFile = scriptSmoke ? option('--script-test-flags') : null
const initialScriptFlags = scriptFlagsFile ? (() => {
  const filename = path.resolve(scriptFlagsFile)
  if (fs.statSync(filename).size > 65536) throw new Error('Script smoke flag fixture is too large')
  return validateInitialScriptFlags(JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown)
})() : undefined
const localServer = new LocalServerHost({
  entryPath: path.join(projectRoot, '@openarcanum/agate/dist/authority.cjs'),
  dataPath: config.dataPath,
  ...(initialScriptFlags ? { initialScriptFlags } : {}),
  mapId: config.developmentMap || 'Bates Mansion Lev 2',
  ...(config.scriptManifestPath ? { scriptManifestPath: config.scriptManifestPath } : {}),
  ...(checkpointFixture ? { checkpointPath: path.join(checkpointFixture, 'checkpoint.json') } :
    config.checkpointPath ? { checkpointPath: config.checkpointPath } : {})
})
localServer.on('failure', error => recordError('local-server', error))
const localSessions = new LocalSessionController(localServer)

app.setName('OpenArcanum')
if (automated) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-electron-smoke-')))
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'serve', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

function recordError(kind: string, error: unknown): void {
  const entry: ErrorEntry = { kind, message: errorMessage(error) }
  const stack = errorStack(error)
  if (stack) entry.stack = stack
  errors.push(entry)
  console.error(`[OpenArcanum:${kind}] ${entry.message}`)
}

async function finishSmoke(renderer: RendererReport | null = null, reason: string | null = null): Promise<void> {
  if (smokeFinished) return
  smokeFinished = true
  clearTimeout(smokeTimer)
  clearTimeout(smokeSettleTimer)
  try {
    // Disconnect the replica first so an intentional server shutdown is quiet.
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      let deadline: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        mainWindow.webContents.executeJavaScript('globalThis.AGate?._engine?.client?.stop()').catch(() => {}),
        new Promise(resolve => { deadline = setTimeout(resolve, 500) })
      ]).finally(() => clearTimeout(deadline))
    }
    await localSessions.invalidate({ closed: true })
    if (checkpointFixture) fs.rmSync(checkpointFixture, { recursive: true, force: true })
  } catch (error) { recordError('local-server-cleanup', error) }
  if (uiTest && renderer && (!renderer.qunit || renderer.qunit.total === 0)) reason = 'QUnit completed without any assertions'
  if (uiTest && renderer?.qunit && (renderer.qunit.testCounts?.total ?? 0) < minimumUiTestCount) {
    reason = `QUnit discovered ${renderer.qunit.testCounts?.total ?? 0} tests; expected at least ${minimumUiTestCount}`
  }
  if (uiTest && renderer && renderer.qunit && renderer.qunit.failed > 0) reason = 'QUnit reported failing assertions'
  let ok = Boolean(renderer) && errors.length === 0 && failedRequests.length === 0 && !reason
  const report = {
    ok,
    mode: uiTest ? 'ui-test' : gameSmoke ? 'game-smoke' : 'smoke',
    reason,
    versions: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
    application: { url: loadUrl, uiRoot, dataPath: config.dataPath, dataDirectoryExists: fs.existsSync(config.dataPath) },
    compatibility: { nodeIntegration: true, contextIsolation: false, webSecurity: true },
    renderer,
    localServer: localServer.getState(),
    errors,
    console: messages,
    failedRequests
  }
  if (smokeReport) {
    try {
      const file = path.resolve(smokeReport)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
    } catch (error) {
      recordError('smoke-report', error)
      ok = report.ok = false
    }
  }
  const prefix = uiTest ? 'OPENARCANUM_UI_TEST' : gameSmoke ? 'OPENARCANUM_GAME_SMOKE' : 'OPENARCANUM_SMOKE'
  process.stdout.write(`${prefix} ${JSON.stringify(report)}\n`, () => app.exit(ok ? 0 : 1))
}

async function serveLocal(request: Request, settings: ProtocolFileOptions & { root: string }): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
  try {
    const file = resolveProtocolFile(settings.root, request.url, settings)
    if (!file) {
      if (automated) failedRequests.push({ url: request.url, status: 404, message: 'Local resource not found' })
      return new Response('Local resource not found', { status: 404 })
    }
    const response = await net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
    const headers = new Headers(response.headers)
    if (settings.scheme === 'asset') {
      headers.set('Access-Control-Allow-Origin', 'serve://app')
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  } catch (error) {
    if (automated) failedRequests.push({ url: request.url, message: errorMessage(error) })
    return new Response('Invalid local resource request', { status: 403 })
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    show: !automated || process.argv.includes('--show'),
    title: 'OpenArcanum',
    backgroundColor: '#191611',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // See README.md: explicit compatibility mode for the existing Node/DOM engine.
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: true,
      webviewTag: false,
      nodeIntegrationInWorker: false,
      backgroundThrottling: !automated,
      additionalArguments: uiTest ? ['--ui-test'] : gameSmoke ? ['--smoke-game'] : smoke ? ['--smoke'] : []
    }
  })

  const contents = mainWindow.webContents
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, target) => {
    if (!target.startsWith(appUrl)) event.preventDefault()
  })
  contents.on('will-attach-webview', event => event.preventDefault())
  contents.on('console-message', details => {
    const record = {
      level: details.level, message: details.message, line: details.lineNumber, source: details.sourceId
    }
    if (automated && messages.length < 200) messages.push(record)
    if (automated && record.level === 'error') recordError('renderer-console', record.message)
  })
  contents.on('did-fail-load', (event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3) {
      recordError('load', `${description} (${code}) at ${url}`)
      if (automated) finishSmoke(null, 'Main application document failed to load')
    }
  })
  contents.on('render-process-gone', (event, details) => {
    recordError('renderer-process', details.reason)
    localSessions.invalidate().catch(error => recordError('local-server-cleanup', error))
    if (automated) finishSmoke(null, 'Renderer process exited')
  })
  mainWindow.on('unresponsive', () => {
    recordError('renderer-process', 'Window became unresponsive')
    if (automated) finishSmoke(null, 'Renderer became unresponsive')
  })
  contents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) localSessions.invalidate().catch(error => recordError('local-server-cleanup', error))
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    localSessions.invalidate().catch(error => recordError('local-server-cleanup', error))
  })
  if (process.argv.includes('--devtools')) contents.openDevTools({ mode: 'detach' })
  if (automated) smokeTimer = setTimeout(() => finishSmoke(null, uiTest ?
    'Timed out waiting for QUnit to finish' : 'Timed out waiting for the real Ember application readiness marker'), smokeTimeout)
  mainWindow.loadURL(loadUrl).catch(error => {
    recordError('load', error)
    if (automated) finishSmoke(null, 'Application load rejected')
  })
}

function isMainApplication(contents: WebContents | null, url: string | undefined): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents &&
    typeof url === 'string' && url.startsWith(appUrl))
}

function authorizeLocalServer(event: IpcMainInvokeEvent): void {
  if (!isMainApplication(event.sender, event.senderFrame?.url) || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Only the main application can control its local server')
  }
}
ipcMain.handle('openarcanum:local-server-start', async (event, requestId: unknown) => {
  authorizeLocalServer(event)
  // A cancelled navigation/start is an expected result. Return it explicitly
  // instead of making Electron print an IPC handler exception for a stale page.
  try { return { ok: true, session: await localSessions.start(requestId) } }
  catch (error) { return { ok: false, message: errorMessage(error) } }
})
ipcMain.handle('openarcanum:local-server-stop', async (event, requestId: unknown) => {
  authorizeLocalServer(event)
  return localSessions.stop(requestId)
})
ipcMain.handle('openarcanum:local-server-state', event => {
  authorizeLocalServer(event)
  return localServer.getState()
})

ipcMain.on('openarcanum:renderer-error', (event, error: unknown) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return
  const kind = error && typeof error === 'object' && 'kind' in error && typeof error.kind === 'string'
    ? error.kind : 'renderer'
  // Renderer errors arrive as serialized objects rather than Error instances.
  recordError(kind, error)
})
ipcMain.on('openarcanum:renderer-ready', (event, renderer: RendererReport) => {
  if ((!smoke && !gameSmoke) || uiTest || smokeFinished || !mainWindow || event.sender !== mainWindow.webContents) return
  if (gameSmoke) {
    if (gameSmokeStarted) return
    gameSmokeStarted = true
    const workshop = config.moduleId === 'inventory-workshop'
    const runGameSmoke = scriptSmoke ? smokeModule('script').runScriptSmoke! :
      workshop ? smokeModule('workshop').runWorkshopSmoke! : smokeModule('game').runGameSmoke!
    // Keep this owned window throughout asynchronous smoke checks.
    const smokeWindow = mainWindow
    if (process.argv.includes('--show')) mainWindow.focus()
    runGameSmoke(smokeWindow.webContents, { timeout: smokeTimeout - 1000, testInput: process.argv.includes('--show'),
      ...(scriptSmoke ? { moduleId: config.moduleId, checkpointPath: path.join(checkpointFixture!, 'checkpoint.json') } : {}) }).then(async result => {
      if (!scriptSmoke && !workshop && !result.error) {
        const runDoorSmoke = smokeModule('door').runDoorSmoke!
        const doors = await runDoorSmoke(smokeWindow.webContents, { testInput: process.argv.includes('--show') })
        result.doors = doors
        if (!doors.ok) result.error = doors.error || 'Door interaction check failed'
      }
      if (!scriptSmoke && !workshop && !result.error) {
        const runCheckpointSmoke = smokeModule('checkpoint').runCheckpointSmoke!
        const checkpoint = await runCheckpointSmoke(smokeWindow.webContents, {
          testInput: process.argv.includes('--show')
        })
        result.checkpoint = checkpoint
        if (!checkpoint.ok) result.error = checkpoint.error || 'Checkpoint check failed'
      }
      if (!scriptSmoke && !workshop && !result.error) {
        const runContainerSmoke = smokeModule('container').runContainerSmoke!
        const containers = await runContainerSmoke(smokeWindow.webContents, {
          testInput: process.argv.includes('--show')
        })
        result.containers = containers
        if (!containers.ok) result.error = containers.error || 'Container inspection check failed'
      }
      if (!scriptSmoke && !workshop && !result.error) {
        const runPauseSmoke = smokeModule('pause').runPauseSmoke!
        const pause = await runPauseSmoke(smokeWindow.webContents, {
          testInput: process.argv.includes('--show')
        })
        result.pause = pause
        if (!pause.ok) result.error = pause.error || 'Local pause check failed'
      }
      const screenshot = option('--game-screenshot')
      if (screenshot) {
        const file = path.resolve(screenshot)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, (await smokeWindow.webContents.capturePage()).toPNG())
        result.screenshot = file
      }
      if (!result.error && process.argv.includes('--game-lifecycle')) {
        const runLocalSessionSmoke = smokeModule('local-session').runLocalSessionSmoke!
        const lifecycle = await runLocalSessionSmoke(smokeWindow.webContents)
        result.lifecycle = lifecycle
        if (!lifecycle.ok) result.error = lifecycle.error || lifecycle.cleanupError || 'Local session lifecycle check failed'
      }
      finishSmoke(result, result.error || null)
    }).catch(error => {
      recordError('game-smoke', error)
      finishSmoke(null, 'Game session check failed')
    })
    return
  }
  // Give errors from initial rendering a short opportunity to surface.
  smokeSettleTimer = setTimeout(() => finishSmoke(renderer), 400)
})
ipcMain.on('openarcanum:ui-tests-done', (event, renderer: RendererReport) => {
  if (!uiTest || smokeFinished || !mainWindow || event.sender !== mainWindow.webContents) return
  smokeSettleTimer = setTimeout(() => finishSmoke(renderer), 400)
})

app.whenReady().then(() => {
  if (!fs.existsSync(path.join(uiRoot, uiTest ? 'tests/index.html' : 'index.html'))) {
    throw new Error('Built Ember UI is missing. Run npm run build before launching Electron.')
  }
  protocol.handle('serve', request => serveLocal(request, { root: uiRoot, scheme: 'serve', host: 'app', index: true }))
  protocol.handle('asset', request => serveLocal(request, { root: config.dataPath, scheme: 'asset', caseInsensitive: true }))
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => {
    return permission === 'display-capture' && details.isMainFrame &&
      isMainApplication(contents, details.requestingUrl)
  })
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'display-capture' && details.isMainFrame &&
      isMainApplication(contents, details.requestingUrl))
  })
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const frame = request.frame
    if (!automated && request.userGesture && request.videoRequested && !request.audioRequested && frame &&
      mainWindow && !mainWindow.isDestroyed() && frame === mainWindow.webContents.mainFrame &&
      frame === frame.top && frame.url.startsWith(appUrl)) {
      // Record this application's WebContents only, never an arbitrary desktop.
      callback({ video: frame })
    } else callback({})
  })
  createWindow()
}).catch(error => {
  recordError('startup', error)
  if (automated) finishSmoke(null, 'Electron startup failed')
  else app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || automated) app.quit()
})
app.on('before-quit', event => {
  if (quitReady) return
  event.preventDefault()
  if (quitting) return
  quitting = true
  localSessions.invalidate({ closed: true }).then(() => {
    quitReady = true
    app.quit()
  }, error => {
    recordError('local-server-cleanup', error)
    app.exit(1)
  })
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && fs.existsSync(path.join(uiRoot, 'index.html'))) createWindow()
})
process.on('uncaughtException', error => {
  recordError('main-uncaught-exception', error)
  if (automated) finishSmoke(null, 'Unhandled main-process exception')
  else app.exit(1)
})
process.on('unhandledRejection', error => {
  recordError('main-unhandled-rejection', error)
  if (automated) finishSmoke(null, 'Unhandled main-process rejection')
})
