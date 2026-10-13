import path from 'node:path'
import { createRequire } from 'node:module'
import { ipcRenderer } from 'electron'
import { errorMessage, errorStack, type DesktopBridge, type LocalSessionReply, type NodeRequireBridge,
  type ProjectConfig, type QUnitAssertion, type QUnitBridge, type QUnitTestCounts } from './desktop-contracts.cjs'
import type { LocalServerState } from './local-server.cjs'

declare global {
  var requireNode: NodeRequireBridge
  interface Window {
    requireNode: NodeRequireBridge
    openArcanumDesktop: DesktopBridge
  }
}

function hasEngine(): boolean {
  return Boolean((globalThis as typeof globalThis & { AGate?: unknown }).AGate)
}
const root = path.resolve(__dirname, '..')
const projectConfig = require(path.join(root, 'config', 'project.js')) as () => ProjectConfig
const config = projectConfig()
const uiTest = process.argv.includes('--ui-test')
let qunitAttached = false

// Compatibility bridge: AGate and several UI libraries synchronously require
// Node modules and use the renderer's DOM. They cannot cross contextBridge as
// constructors. Keep this explicit until the engine is split behind IPC.
const requireNode = createRequire(path.join(root, 'package.json'))
global.requireNode = requireNode
window.requireNode = requireNode
window.openArcanumDesktop = Object.freeze<DesktopBridge>({
  config,
  compatibilityMode: true,
  attachQUnit,
  startLocalServer: async requestId => {
    const result: LocalSessionReply = await ipcRenderer.invoke('openarcanum:local-server-start', requestId)
    if (!result.ok) throw new Error(result.message)
    return result.session
  },
  stopLocalServer: requestId => ipcRenderer.invoke('openarcanum:local-server-stop', requestId) as Promise<LocalServerState>,
  getLocalServerState: () => ipcRenderer.invoke('openarcanum:local-server-state') as Promise<LocalServerState>,
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron, node: process.versions.node })
})

function attachQUnit(qunit: QUnitBridge): void {
  if (!uiTest || qunitAttached) return
  qunitAttached = true
  const failures: Array<{ test: string | null; module: string | null; message: string;
    actual: string; expected: string; source: string | null }> = []
  let testCounts: QUnitTestCounts | null = null
  qunit.on('runEnd', details => { testCounts = { ...details.testCounts } })
  qunit.log((details: QUnitAssertion) => {
    if (!details.result && failures.length < 100) failures.push({
      test: details.name ? String(details.name) : null,
      module: details.module ? String(details.module) : null,
      message: String(details.message || 'Failed assertion'),
      actual: String(details.actual),
      expected: String(details.expected),
      source: details.source ? String(details.source) : null
    })
  })
  qunit.done(details => {
    ipcRenderer.send('openarcanum:ui-tests-done', {
      qunit: { passed: details.passed, failed: details.failed, total: details.total, runtime: details.runtime, testCounts, failures },
      hasAGate: hasEngine(),
      title: document.title,
      location: window.location.href
    })
  })
}

function reportError(kind: string, value: unknown): void {
  ipcRenderer.send('openarcanum:renderer-error', {
    kind,
    message: errorMessage(value),
    stack: errorStack(value) || null
  })
}
window.addEventListener('error', event => {
  if (event.error || event.message) reportError('error', event.error || event.message)
})
window.addEventListener('unhandledrejection', event => reportError('unhandledrejection', event.reason))
process.on('uncaughtException', error => reportError('node-uncaught-exception', error))
process.on('unhandledRejection', error => reportError('node-unhandled-rejection', error))

if ((process.argv.includes('--smoke') || process.argv.includes('--smoke-game')) && !uiTest) {
  window.addEventListener('DOMContentLoaded', () => {
    const timer = setInterval(() => {
      const marker = document.querySelector('[data-app-ready]')
      if (!marker || marker.getAttribute('data-app-ready') === 'false') return
      const assetsMarker = document.querySelector('[data-assets-state]')
      ipcRenderer.send('openarcanum:renderer-ready', {
        marker: marker.getAttribute('data-app-ready'),
        assetsState: assetsMarker ? assetsMarker.getAttribute('data-assets-state') : null,
        emberViewCount: document.querySelectorAll('.ember-view').length,
        hasAGate: hasEngine(),
        title: document.title,
        location: window.location.href
      })
      clearInterval(timer)
    }, 100)
  }, { once: true })
}
