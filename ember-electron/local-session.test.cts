'use strict'

const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { test } = require('node:test') as typeof import('node:test')
const { LocalSessionController } = require('../dist-electron/local-session.cjs')

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

class DeferredHost {
  declare state: 'stopped' | 'starting' | 'running' | 'stopping'
  declare starts: ReturnType<typeof deferred>[]
  declare stops: ReturnType<typeof deferred>[]
  declare pid: number | null
  constructor() {
    this.state = 'stopped'
    this.starts = []
    this.stops = []
    this.pid = null
  }

  getState() { return { state: this.state, pid: this.pid, mapId: 'Synthetic map' } }

  start() {
    assert.notEqual(this.state, 'stopping', 'Controller must await exit before calling host.start')
    const operation = deferred()
    this.starts.push(operation)
    this.pid = 100 + this.starts.length
    this.state = 'starting'
    return operation.promise
  }

  ready(index = this.starts.length - 1) {
    this.state = 'running'
    this.starts[index].resolve({ url: 'http://127.0.0.1:12345', token: 'private-test-token',
      observerToken: 'private-observer-token', protocolVersion: 2, pid: this.pid, mapId: 'Synthetic map' })
  }

  fail(index = this.starts.length - 1) {
    this.state = 'stopped'
    this.pid = null
    this.starts[index].reject(new Error('Synthetic startup failure'))
  }

  stop() {
    if (this.state === 'stopped') return Promise.resolve()
    if (this.state === 'stopping') return this.stops[this.stops.length - 1].promise
    const operation = deferred()
    this.stops.push(operation)
    this.state = 'stopping'
    return operation.promise
  }

  exit() {
    this.state = 'stopped'
    this.pid = null
    // The production host rejects in-flight startup once its child is reaped.
    for (const start of this.starts) start.reject(new Error('Host stopped during startup'))
    this.stops[this.stops.length - 1].resolve()
  }
}

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('invalidate cancels a queued replacement before old child exit without spawning it', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const original = sessions.start('A')
  host.ready()
  await original
  const stopping = sessions.stop('A')
  const stale = assert.rejects(sessions.start('A'), /superseded or stopped/)
  const invalidating = sessions.invalidate()
  host.exit()
  await Promise.all([stopping, stale, invalidating])
  assert.equal(host.starts.length, 1)
  assert.equal(host.getState().state, 'stopped')
})

test('a replacement supersedes pending startup and stale component cleanup cannot stop its session', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const stale = assert.rejects(sessions.start('A'), /Host stopped during startup/)
  const replacement = sessions.start('B')
  assert.equal(host.state, 'stopping')
  host.exit()
  await stale
  await flush()
  assert.equal(host.starts.length, 2)
  const state = await sessions.stop('A')
  assert.equal(state.state, 'starting')
  assert.equal(host.stops.length, 1)
  host.ready()
  assert.equal((await replacement).pid, 102)
  await sessions.stop('A')
  assert.equal(host.state, 'running')
  assert.equal(host.stops.length, 1)
})

test('concurrent starts with the same request share one child and one readiness promise', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const first = sessions.start('A')
  assert.equal(sessions.start('A'), first)
  assert.equal(host.starts.length, 1)
  host.ready()
  const result = await first
  assert.deepEqual(await sessions.start('A'), result)
  assert.equal(host.starts.length, 1)
})

test('closing invalidates outstanding requests permanently and forbids further starts', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const stale = assert.rejects(sessions.start('A'), /Host stopped during startup/)
  const closing = sessions.invalidate({ closed: true })
  host.exit()
  await Promise.all([stale, closing])
  await assert.rejects(sessions.start('B'), /controller is closed/)
  await sessions.invalidate({ closed: false })
  await assert.rejects(sessions.start('C'), /controller is closed/)
  assert.equal(host.starts.length, 1)
})

test('a failed startup can be retried with the same request ID', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const failed = assert.rejects(sessions.start('A'), /Synthetic startup failure/)
  host.fail()
  await failed
  const retry = sessions.start('A')
  assert.equal(host.starts.length, 2)
  host.ready()
  assert.equal((await retry).pid, 102)
})

test('the latest of multiple replacements is the only request allowed to start after exit', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const first = sessions.start('A')
  host.ready()
  await first
  const stale = assert.rejects(sessions.start('B'), /superseded or stopped/)
  const latest = sessions.start('C')
  assert.equal(sessions.start('C'), latest)
  host.exit()
  await stale
  await flush()
  assert.equal(host.starts.length, 2)
  host.ready()
  await latest
  assert.equal(sessions.current.id, 'C')
})

test('same-ID retry waits for a host shutdown that began outside the renderer lease', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  const first = sessions.start('A')
  host.ready()
  await first
  const externalStop = host.stop()
  const retry = sessions.start('A')
  assert.notEqual(retry, first)
  assert.equal(sessions.start('A'), retry)
  assert.equal(host.starts.length, 1)
  host.exit()
  await externalStop
  await flush()
  assert.equal(host.starts.length, 2)
  host.ready()
  await retry
})

test('invalid request IDs are rejected and cleanup replies expose only host state', async () => {
  const host = new DeferredHost()
  const sessions = new LocalSessionController(host)
  for (const id of ['', undefined, 1, 'x'.repeat(129)]) {
    assert.throws(() => sessions.start(id), /request ID/)
    await assert.rejects(sessions.stop(id), /request ID/)
  }
  const reply = await sessions.stop('absent')
  assert.deepEqual(reply, { state: 'stopped', pid: null, mapId: 'Synthetic map' })
  assert.equal('token' in reply, false)
})
