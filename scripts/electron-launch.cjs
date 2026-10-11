#!/usr/bin/env node
'use strict'

const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const projectRoot = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const uiTest = args.includes('--ui-test')
const automated = uiTest || args.includes('--smoke')
const resultPrefix = uiTest ? 'OPENARCANUM_UI_TEST' : 'OPENARCANUM_SMOKE'
let receivedReport = false
let outputTail = ''

function reportLaunchFailure(message, code = null, signal = null) {
  if (!automated || receivedReport) return
  receivedReport = true
  const report = {
    ok: false,
    mode: uiTest ? 'ui-test' : 'smoke',
    reason: message,
    renderer: null,
    exitCode: code,
    signal,
    errors: [{ kind: 'electron-launch', message }],
    console: [],
    failedRequests: []
  }
  const reportArg = args.find(value => value.startsWith('--ui-test-report=')) ||
    args.find(value => value.startsWith('--smoke-report='))
  if (reportArg) {
    try {
      const file = path.resolve(reportArg.slice(reportArg.indexOf('=') + 1))
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
    } catch (error) {
      report.errors.push({ kind: 'report-file', message: error.message })
    }
  }
  process.stdout.write(`${resultPrefix} ${JSON.stringify(report)}\n`)
}

let executable
try {
  executable = require('electron')
} catch (error) {
  console.error('Electron is unavailable. Run npm ci and npm run build before launching.')
  console.error(error.message)
  reportLaunchFailure(error.message)
  process.exit(1)
}

const env = { ...process.env }
// Desktop terminals can inherit this flag from their own Electron host.
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(executable, [path.join(projectRoot, 'ember-electron', 'main.js'), ...args], {
  cwd: projectRoot,
  stdio: ['inherit', 'pipe', 'inherit'],
  env
})
child.stdout.on('data', chunk => {
  const output = outputTail + chunk.toString()
  if (output.includes(`${resultPrefix} `)) receivedReport = true
  outputTail = output.slice(-resultPrefix.length)
  process.stdout.write(chunk)
})
child.on('error', error => {
  console.error(`Electron could not start: ${error.message}`)
  reportLaunchFailure(`Electron could not start: ${error.message}`)
  process.exitCode = 1
})
child.on('close', (code, signal) => {
  if (signal) console.error(`Electron exited after ${signal}`)
  const missingReport = automated && !receivedReport
  if (missingReport) reportLaunchFailure('Electron exited before producing its renderer report', code, signal)
  process.exitCode = missingReport || code === null || code < 0 ? 1 : code
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (!child.killed) child.kill(signal) })
}
