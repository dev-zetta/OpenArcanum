import type {WebContents} from 'electron'
'use strict'

const { randomUUID } = require('node:crypto') as typeof import('node:crypto')
const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

function isAlive(pid) {
  try { process.kill(pid, 0); return true }
  catch (error) { if (error.code === 'ESRCH') return false; throw error }
}

// Run after the real scene smoke and screenshot. Credentials stay in memory;
// only process IDs, public protocol metadata and cleanup evidence are returned.
async function runLocalSessionSmoke(contents, { timeout = 30000 } = {}) {
  const deadline = Date.now() + timeout
  const sockets = new Set<ReturnType<typeof io>>()
  // Renderer evaluation results are the dynamic payload returned by Electron's API.
  const report: Record<string, Awaited<ReturnType<WebContents['executeJavaScript']>>> = { ok: false }
  const racingRequest = randomUUID()
  const freshRequest = randomUUID()
  let cleanupRequest = racingRequest

  async function bounded(operation, description, limit = deadline - Date.now()) {
    let timer
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timed out ${description}`)), Math.max(1, limit))
        })
      ])
    } finally { clearTimeout(timer) }
  }

  const evaluate = (source, description) => bounded(contents.executeJavaScript(source), description)

  async function until(predicate, description) {
    while (Date.now() < deadline) {
      if (await predicate()) return
      await delay(40)
    }
    throw new Error(`Timed out ${description}`)
  }

  async function join(session, role) {
    const socket = io(session.url, {
      auth: { version: 2, token: role === 'observer' ? session.observerToken : session.token },
      transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true,
      timeout: Math.min(5000, Math.max(1, deadline - Date.now()))
    })
    sockets.add(socket)
    const state: {socket: ReturnType<typeof io>; disconnected: boolean; disconnectReason: string | null; joined?: {role: string; version: number; mapId: string; actorId: string; revision: number}} = {socket, disconnected: false, disconnectReason: null }
    socket.once('disconnect', reason => { state.disconnected = true; state.disconnectReason = reason })
    await bounded(new Promise<void>((resolve, reject) => {
      const connected = () => { socket.off('connect_error', failed); resolve() }
      const failed = error => { socket.off('connect', connected); reject(error) }
      socket.once('connect', connected)
      socket.once('connect_error', failed)
      socket.connect()
    }), `connecting the lifecycle ${role}`)
    const joined = await bounded(socket.timeout(5000).emitWithAck('authority:join', { version: 2 }),
      `joining the lifecycle ${role}`)
    if (!joined?.ok || joined.version !== 2 || joined.role !== role || joined.mapId !== session.mapId ||
        !joined.snapshot?.actors?.some(actor => actor.id === joined.actorId)) {
      throw new Error(`The lifecycle ${role} did not join the expected authoritative map`)
    }
    state.joined = { role: joined.role, version: joined.version, mapId: joined.mapId,
      actorId: joined.actorId, revision: joined.snapshot.revision }
    return state
  }

  try {
    const original = await evaluate(`(async () => {
      const client = globalThis.AGate?._engine?.client;
      return { host: await window.openArcanumDesktop.getLocalServerState(),
        connected: !!client?.getDevelopmentState().authority?.connected,
        session: client?.options.authoritySession };
    })()`, 'reading the running local session')
    if (original.host.state !== 'running' || !Number.isInteger(original.host.pid) ||
        original.host.pid <= 0 || !original.connected || original.session?.pid !== original.host.pid) {
      throw new Error('Lifecycle verification requires the running authoritative scene')
    }
    const observer = await join(original.session, 'observer')
    const replica = await evaluate(`(() => {
      const client = globalThis.AGate._engine.client;
      client.stop();
      return { stopped: client.stopped, connected: client.getDevelopmentState().authority.connected };
    })()`, 'disconnecting the old renderer replica')
    if (!replica.stopped || replica.connected) throw new Error('The old renderer replica did not disconnect')
    report.original = { pid: original.host.pid, connectedBefore: original.connected,
      connectedAfter: replica.connected, observer: observer.joined }

    // Own a distinct bridge lease rather than accessing private Ember state.
    const racing = await evaluate(`window.openArcanumDesktop.startLocalServer(${JSON.stringify(racingRequest)})`,
      'acquiring the lifecycle bridge lease')
    if (!Number.isInteger(racing.pid) || racing.pid <= 0 || racing.pid === original.host.pid) {
      throw new Error('A new bridge lease did not replace the prior local process')
    }
    await until(() => !isAlive(original.host.pid) && observer.disconnected,
      'reaping the original server and disconnecting its observer')
    report.original.reaped = true
    report.original.observerDisconnected = observer.disconnected
    report.original.observerDisconnectReason = observer.disconnectReason

    // Both requests are sent before reload. A start deferred behind stop must
    // be invalidated by navigation instead of resurrecting an unowned child.
    let loaded
    const nextLoad = new Promise<void>(resolve => { loaded = resolve; contents.once('did-finish-load', loaded) })
    try {
      await evaluate(`(() => {
        const desktop = window.openArcanumDesktop;
        desktop.stopLocalServer(${JSON.stringify(racingRequest)}).catch(() => {});
        desktop.startLocalServer(${JSON.stringify(racingRequest)}).catch(() => {});
        return true;
      })()`, 'dispatching overlapping local session requests')
      contents.reload()
      await bounded(nextLoad, 'reloading the application document')
    } finally { contents.off('did-finish-load', loaded) }
    await until(async () => await evaluate(`Boolean(document.querySelector('[data-app-ready]') &&
      window.openArcanumDesktop?.getLocalServerState)`, 'waiting for the reloaded Ember application'),
    'waiting for the reloaded Ember application')
    await until(() => !isAlive(racing.pid), 'reaping the session invalidated by reload')
    // Observe after exit, including the queued Promise continuations which used
    // to start a second child after the navigation cleanup had already resolved.
    await delay(300)
    const afterReload = await evaluate(`window.openArcanumDesktop.getLocalServerState()`,
      'reading local server state after reload')
    const runtime = await evaluate(`document.querySelector('[data-runtime-state]')?.getAttribute('data-runtime-state')`,
      'reading the reloaded runtime state')
    report.reload = { priorPid: racing.pid, priorReaped: true, host: afterReload, runtime }
    if (afterReload.state !== 'stopped' || afterReload.pid !== null || runtime !== 'ready') {
      throw new Error('Reload resurrected a pending server or started the local runtime unexpectedly')
    }

    cleanupRequest = freshRequest
    const fresh = await evaluate(`window.openArcanumDesktop.startLocalServer(${JSON.stringify(freshRequest)})`,
      'starting a fresh local session after reload')
    if (!Number.isInteger(fresh.pid) || fresh.pid <= 0 ||
        fresh.pid === racing.pid || fresh.pid === original.host.pid) {
      throw new Error('The reloaded document did not start a fresh local server process')
    }
    const owner = await join(fresh, 'owner')
    const afterStaleStop = await evaluate(`window.openArcanumDesktop.stopLocalServer(${JSON.stringify(racingRequest)})`,
      'rejecting a stale document lease cleanup')
    if (afterStaleStop.state !== 'running' || afterStaleStop.pid !== fresh.pid || !owner.socket.connected) {
      throw new Error('A stale lease stopped the fresh document session')
    }
    const stopped = await evaluate(`window.openArcanumDesktop.stopLocalServer(${JSON.stringify(freshRequest)})`,
      'stopping the fresh local session')
    await until(() => !isAlive(fresh.pid) && owner.disconnected, 'reaping the fresh server and disconnecting its owner')
    report.fresh = { pid: fresh.pid, owner: owner.joined, ownerDisconnected: owner.disconnected,
      ownerDisconnectReason: owner.disconnectReason, staleStopIgnored: true, reaped: true, host: stopped }
    if (stopped.state !== 'stopped' || stopped.pid !== null) throw new Error('Fresh session cleanup left an owned child')
    report.ok = true
  } catch (error) {
    report.error = `Local session lifecycle check failed: ${error.message}`
  } finally {
    for (const socket of sockets) { socket.removeAllListeners(); socket.disconnect() }
    if (!contents.isDestroyed()) {
      try {
        await bounded(contents.executeJavaScript(`window.openArcanumDesktop?.stopLocalServer?.(${JSON.stringify(cleanupRequest)})`),
          'cleaning up the lifecycle session', 5000)
      } catch (error) {
        report.ok = false
        report.cleanupError = error.message
        if (!report.error) report.error = 'Local session lifecycle cleanup failed'
      }
    }
  }
  return report
}

module.exports = { runLocalSessionSmoke }
