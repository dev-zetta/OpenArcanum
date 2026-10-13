'use strict'

const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { fork } = require('node:child_process') as typeof import('node:child_process')
const { once } = require('node:events') as typeof import('node:events')
const fs = require('node:fs') as typeof import('node:fs')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const { test } = require('node:test') as typeof import('node:test')
const { LocalServerHost } = require('../dist-electron/local-server.cjs')

function fixture(t, mode = 'ready', options = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-local-host-'))
  const entryPath = path.join(temporary, 'child.cjs')
  fs.writeFileSync(entryPath, `
    'use strict'
    const fs = require('node:fs')
    const mode = ${JSON.stringify(mode)}
    const keepAlive = setInterval(() => {}, 1000)
    if (mode === 'stubborn') process.on('SIGTERM', () => {})
    process.on('message', message => {
      if (message.type === 'stop') {
        if (mode !== 'stubborn') { clearInterval(keepAlive); process.exit(0) }
        return
      }
      if (message.type !== 'start') return
      const config = message.config
      fs.writeSync(1, 'CONFIG ' + JSON.stringify(config) + '\\n')
      if (mode === 'exit') return process.exit(7)
      if (mode === 'silent') return
      if (mode === 'error') {
        process.send({ type: 'error', message: 'Broken data ' + config.ownerToken })
        return
      }
      if (mode === 'stubborn') return
      const ready = () => {
        process.send({
          type: 'ready',
          url: mode === 'invalid' ? 'http://192.0.2.1:1234' : 'http://127.0.0.1:12345',
          protocolVersion: 1,
          mapId: config.mapId
        })
        if (mode === 'later-exit') setTimeout(() => process.exit(9), 80)
      }
      if (mode === 'noisy') {
        fs.writeSync(2, 'x'.repeat(100000) + '\\n')
        fs.writeSync(2, config.ownerToken.slice(0, 32))
        fs.writeSync(2, config.ownerToken.slice(32) + '\\n' + config.observerToken + '\\n')
        ready()
        return
      }
      ready()
    })
  `)
  const host = new LocalServerHost({
    entryPath,
    dataPath: path.join(temporary, 'converted-data'),
    mapId: 'Bates',
    startupTimeoutMs: 2000,
    stopTimeoutMs: 150,
    killTimeoutMs: 150,
    ...options
  })
  t.after(async () => {
    await host.stop()
    fs.rmSync(temporary, { recursive: true, force: true })
  })
  return { host, entryPath, temporary }
}

function assertGone(pid) {
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
}

test('starts one owned child, sends private configuration over IPC and stops it before resolving', async t => {
  let spawned
  const { host } = fixture(t, 'ready', {
    fork(entry, args, options) {
      spawned = { entry, args, options, child: fork(entry, args, options) }
      return spawned.child
    }
  })
  const first = host.start()
  assert.deepEqual(host.getState(), { state: 'starting', pid: spawned.child.pid, mapId: 'Bates' })
  assert.equal(host.start(), first)
  const session = await first
  assert.equal(session.url, 'http://127.0.0.1:12345')
  assert.equal(session.mapId, 'Bates')
  assert.equal(session.protocolVersion, 1)
  assert.match(session.token, /^[a-f\d]{64}$/)
  assert.match(session.observerToken, /^[a-f\d]{64}$/)
  assert.notEqual(session.token, session.observerToken)
  assert.equal(session.pid, spawned.child.pid)
  assert.deepEqual(host.getState(), { state: 'running', pid: session.pid, mapId: 'Bates' })
  assert.equal(spawned.options.env.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(spawned.options.env.NODE_OPTIONS, undefined)
  assert.equal(spawned.options.env.NODE_PATH, undefined)
  assert.deepEqual(spawned.options.execArgv, [])
  assert.equal(JSON.stringify(spawned.options).includes(session.token), false)
  assert.deepEqual(await host.start(), session)
  const stopping = host.stop()
  assert.equal(host.stop(), stopping)
  await stopping
  assertGone(session.pid)
  assert.deepEqual(host.getState(), { state: 'stopped', pid: null, mapId: 'Bates' })
  await host.stop()
  const restarted = await host.start()
  assert.notEqual(restarted.pid, session.pid)
  assert.notEqual(restarted.token, session.token)
})

test('keeps a bounded diagnostic ring and redacts credentials split across log chunks', async t => {
  const { host } = fixture(t, 'noisy')
  const session = await host.start()
  await host.stop()
  assert.ok(host.diagnostics.length <= 16 * 1024)
  assert.ok(host.diagnostics.includes('[redacted]'))
  assert.equal(host.diagnostics.includes(session.token), false)
  assert.equal(host.diagnostics.includes(session.observerToken), false)
})

test('passes an optional checkpoint path through private IPC without exposing it in the session', async t => {
  const checkpointPath = path.join(os.tmpdir(), 'openarcanum-private-checkpoint-test.json')
  let startMessage
  const { host } = fixture(t, 'ready', { checkpointPath,
    fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) {
      const child = fork(...args)
      const send = child.send.bind(child)
      child.send = (message, ...rest) => {
        if (message.type === 'start') startMessage = message
        return send(message, ...rest)
      }
      return child
    }
  })
  const session = await host.start()
  assert.equal(startMessage.config.checkpointPath, checkpointPath)
  assert.equal(Object.hasOwn(session, 'checkpointPath'), false)
  assert.equal(Object.hasOwn(host.getState(), 'checkpointPath'), false)
})

test('cleans up a startup error and removes credentials from propagated errors', async t => {
  let child
  const { host } = fixture(t, 'error', { fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) { child = fork(...args); return child } })
  await assert.rejects(host.start(), (error: Error) => {
    assert.match(error.message, /Broken data \[redacted\]/)
    assert.doesNotMatch(error.message, /[a-f\d]{64}/)
    return true
  })
  assertGone(child.pid)
})

test('rejects early child exit and unexpected readiness without leaking a process', async t => {
  for (const mode of ['exit', 'invalid']) {
    let child
    const { host } = fixture(t, mode, { fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) { child = fork(...args); return child } })
    await assert.rejects(host.start(), mode === 'exit' ? /before becoming ready/ : /invalid readiness/)
    assertGone(child.pid)
  }
})

test('times out and forcibly reaps a child that ignores both IPC stop and SIGTERM', async t => {
  let child
  const { host } = fixture(t, 'stubborn', {
    startupTimeoutMs: 150,
    fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) { child = fork(...args); return child }
  })
  await assert.rejects(host.start(), /startup timed out/)
  assert.equal(child.signalCode, 'SIGKILL')
  assertGone(child.pid)
})

test('stop during startup rejects the pending start only after the child is reaped', async t => {
  let child
  const { host } = fixture(t, 'silent', { fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) { child = fork(...args); return child } })
  const pending = host.start()
  const rejected = assert.rejects(pending, /startup was cancelled/)
  await host.stop()
  await rejected
  assertGone(child.pid)
})

test('a new start waits for a prior running session to finish stopping', async t => {
  const { host } = fixture(t)
  const old = await host.start()
  const stopping = host.stop()
  const pending = host.start()
  await stopping
  const fresh = await pending
  assertGone(old.pid)
  assert.notEqual(fresh.pid, old.pid)
})

test('reports unexpected running exit with a failure event and permits a fresh session', async t => {
  const { host } = fixture(t, 'later-exit')
  const failure = once(host, 'failure')
  const original = await host.start()
  const [error] = await failure
  assert.match(error.message, /exited unexpectedly \(code 9/)
  assertGone(original.pid)
  const fresh = await host.start()
  assert.notEqual(fresh.pid, original.pid)
})

test('a synchronous fork failure leaves the host reusable', async t => {
  let fail = true
  const { host } = fixture(t, 'ready', {
    fork(...args: [modulePath: string, args?: readonly string[], options?: import("node:child_process").ForkOptions]) {
      if (fail) { fail = false; throw new Error('Synthetic fork failure') }
      return fork(...args)
    }
  })
  await assert.rejects(host.start(), /Synthetic fork failure/)
  assert.ok((await host.start()).pid)
})

test('an asynchronous spawn failure leaves no active session', async t => {
  const { host } = fixture(t, 'ready', {
    fork(entry, args, options) {
      return fork(entry, args, { ...options, execPath: path.join(os.tmpdir(), 'openarcanum-missing-node-executable') })
    }
  })
  await assert.rejects(host.start(), /Local server process failed:.*ENOENT/)
  assert.deepEqual(host.getState(), { state: 'stopped', pid: null, mapId: 'Bates' })
})
