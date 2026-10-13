const fs = require('node:fs') as typeof import('node:fs')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const { app, BrowserWindow } = require('electron') as typeof import('electron')
const fixture = process.argv[2]
const softwareRendering = process.argv.includes('--software-rendering')
const errors = []
let finished = false
let window
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'agate-renderer-smoke-'))
app.setPath('userData', userData)
if (softwareRendering) {
  // Force the CPU-backed SwANGLE driver for this owned synthetic fixture only.
  // https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
  app.commandLine.appendSwitch('use-gl', 'angle')
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
}

function finish(ok, renderer = null, error = null) {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  const report = { ok, electron: process.versions.electron,
    renderingMode: softwareRendering ? 'swiftshader' : 'default', renderer, errors, error }
  process.stdout.write(`AGATE_RENDERER_SMOKE ${JSON.stringify(report)}\n`, () => app.exit(ok ? 0 : 1))
}
const timeout = setTimeout(() => finish(false, null, 'Renderer smoke timed out'), 30000)
app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 128,
    height: 128,
    useContentSize: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })
  window.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message)
  })
  window.webContents.on('render-process-gone', (_event, details) => finish(false, null, `Renderer exited: ${details.reason}`))
  await window.loadURL('data:text/html,<html><body style="margin:0"><canvas></canvas></body></html>')
  const renderer = await window.webContents.executeJavaScript(`require(${JSON.stringify(fixture)}).runSmoke()`)
  if (softwareRendering && !/swiftshader/i.test(renderer.gpu)) {
    throw new Error(`SwiftShader was requested but the renderer reported: ${renderer.gpu}`)
  }
  finish(errors.length === 0, renderer)
}).catch(error => finish(false, null, error.stack || error.message))
