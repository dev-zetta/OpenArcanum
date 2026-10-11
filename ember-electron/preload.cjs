'use strict'

const path = require('node:path')
const { createRequire } = require('node:module')
const { ipcRenderer } = require('electron')
const root = path.resolve(__dirname, '..')
const config = require(path.join(root, 'config', 'project.js'))()
const uiTest = process.argv.includes('--ui-test')
let qunitAttached = false

// Compatibility bridge: AGate and several UI libraries synchronously require
// Node modules and use the renderer's DOM. They cannot cross contextBridge as
// constructors. Keep this explicit until the engine is split behind IPC.
const requireNode = createRequire(path.join(root, 'package.json'))
global.requireNode = requireNode
window.requireNode = requireNode
window.openArcanumDesktop = Object.freeze({
  config,
  compatibilityMode: true,
  attachQUnit,
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron, node: process.versions.node })
})

function attachQUnit(qunit) {
  if (!uiTest || qunitAttached) return
  qunitAttached = true
  const failures = []
  let testCounts = null
  qunit.on('runEnd', details => { testCounts = { ...details.testCounts } })
  qunit.log(details => {
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
      hasAGate: Boolean(global.AGate),
      title: document.title,
      location: window.location.href
    })
  })
}

function reportError(kind, value) {
  ipcRenderer.send('openarcanum:renderer-error', {
    kind,
    message: String(value && value.message ? value.message : value),
    stack: value && value.stack ? String(value.stack) : null
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
        hasAGate: Boolean(global.AGate),
        title: document.title,
        location: window.location.href
      })
      clearInterval(timer)
    }, 100)
  }, { once: true })
}
