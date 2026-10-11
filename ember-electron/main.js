/* eslint-env node */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain, net, protocol, session } = require('electron')
const { resolveProtocolFile } = require('./protocol-files.cjs')

const projectRoot = path.resolve(__dirname, '..')
const config = require(path.join(projectRoot, 'config', 'project.js'))()
const uiRoot = path.join(projectRoot, 'dist')
const appUrl = 'serve://app/'
const smoke = process.argv.includes('--smoke')
const uiTest = process.argv.includes('--ui-test')
const gameSmoke = process.argv.includes('--smoke-game')
const automated = smoke || uiTest || gameSmoke
const loadUrl = uiTest ? `${appUrl}tests/index.html` : appUrl
const option = name => {
  const prefix = `${name}=`
  const argument = process.argv.find(value => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : null
}
const defaultTimeout = gameSmoke ? 120000 : uiTest ? 60000 : 15000
const configuredTimeout = Number(option('--game-smoke-timeout') || option('--ui-test-timeout') || option('--smoke-timeout') || defaultTimeout)
const smokeTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : defaultTimeout
const smokeReport = option('--game-smoke-report') || option('--ui-test-report') || option('--smoke-report')
const errors = []
const messages = []
const failedRequests = []
let mainWindow
let smokeFinished = false
let smokeTimer
let smokeSettleTimer
let gameSmokeStarted = false

app.setName('OpenArcanum')
if (automated) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-electron-smoke-')))
}
protocol.registerSchemesAsPrivileged([
  { scheme: 'serve', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

function recordError(kind, error) {
  const entry = { kind, message: String(error && error.message ? error.message : error) }
  if (error && error.stack) entry.stack = String(error.stack)
  errors.push(entry)
  console.error(`[OpenArcanum:${kind}] ${entry.message}`)
}

function finishSmoke(renderer = null, reason = null) {
  if (smokeFinished) return
  smokeFinished = true
  clearTimeout(smokeTimer)
  clearTimeout(smokeSettleTimer)
  if (uiTest && renderer && (!renderer.qunit || renderer.qunit.total === 0)) reason = 'QUnit completed without any assertions'
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

async function serveLocal(request, settings) {
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
    if (automated) failedRequests.push({ url: request.url, message: error.message })
    return new Response('Invalid local resource request', { status: 403 })
  }
}

function createWindow() {
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
    if (automated && (record.level === 'error' || record.level === 3)) recordError('renderer-console', record.message)
  })
  contents.on('did-fail-load', (event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3) {
      recordError('load', `${description} (${code}) at ${url}`)
      if (automated) finishSmoke(null, 'Main application document failed to load')
    }
  })
  contents.on('render-process-gone', (event, details) => {
    recordError('renderer-process', details.reason)
    if (automated) finishSmoke(null, 'Renderer process exited')
  })
  mainWindow.on('unresponsive', () => {
    recordError('renderer-process', 'Window became unresponsive')
    if (automated) finishSmoke(null, 'Renderer became unresponsive')
  })
  mainWindow.on('closed', () => { mainWindow = null })
  if (process.argv.includes('--devtools')) contents.openDevTools({ mode: 'detach' })
  if (automated) smokeTimer = setTimeout(() => finishSmoke(null, uiTest ?
    'Timed out waiting for QUnit to finish' : 'Timed out waiting for the real Ember application readiness marker'), smokeTimeout)
  mainWindow.loadURL(loadUrl).catch(error => {
    recordError('load', error)
    if (automated) finishSmoke(null, 'Application load rejected')
  })
}

function isMainApplication(contents, url) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents &&
    typeof url === 'string' && url.startsWith(appUrl))
}

ipcMain.on('openarcanum:renderer-error', (event, error) => {
  if (mainWindow && event.sender === mainWindow.webContents) recordError(error.kind || 'renderer', error)
})
ipcMain.on('openarcanum:renderer-ready', (event, renderer) => {
  if ((!smoke && !gameSmoke) || uiTest || smokeFinished || !mainWindow || event.sender !== mainWindow.webContents) return
  if (gameSmoke) {
    if (gameSmokeStarted) return
    gameSmokeStarted = true
    const { runGameSmoke } = require('./game-smoke.cjs')
    if (process.argv.includes('--show')) mainWindow.focus()
    runGameSmoke(mainWindow.webContents, { timeout: smokeTimeout - 1000, testInput: process.argv.includes('--show') }).then(async result => {
      const screenshot = option('--game-screenshot')
      if (screenshot) {
        const file = path.resolve(screenshot)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, (await mainWindow.webContents.capturePage()).toPNG())
        result.screenshot = file
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
ipcMain.on('openarcanum:ui-tests-done', (event, renderer) => {
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
    } else callback(null)
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
