'use strict'

const { fork: forkProcess } = require('node:child_process')
const { randomBytes } = require('node:crypto')
const { EventEmitter } = require('node:events')
const path = require('node:path')

const DIAGNOSTIC_LIMIT = 16 * 1024

function positiveTimeout(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function waitForExit(run, timeout) {
  if (run.exited) return Promise.resolve(true)
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeout)
    run.exitPromise.then(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/** Owns the private local server process; credentials travel only over its IPC pipe. */
class LocalServerHost extends EventEmitter {
  constructor({ entryPath, dataPath, mapId, checkpointPath, fork = forkProcess, startupTimeoutMs, stopTimeoutMs, killTimeoutMs }) {
    super()
    if (typeof entryPath !== 'string' || !entryPath) throw new Error('A local server entry path is required')
    if (typeof dataPath !== 'string' || !dataPath) throw new Error('A local server data path is required')
    if (typeof mapId !== 'string' || !mapId) throw new Error('A local server map ID is required')
    this.entryPath = path.resolve(entryPath)
    this.dataPath = path.resolve(dataPath)
    this.mapId = mapId
    if (checkpointPath !== undefined && (typeof checkpointPath !== 'string' || !checkpointPath)) {
      throw new Error('A configured checkpoint path must be a nonempty string')
    }
    this.checkpointPath = checkpointPath === undefined ? undefined : path.resolve(checkpointPath)
    this._fork = fork
    this._startupTimeout = positiveTimeout(startupTimeoutMs, 60000)
    this._stopTimeout = positiveTimeout(stopTimeoutMs, 3000)
    this._killTimeout = positiveTimeout(killTimeoutMs, 1000)
    this._run = null
    this._diagnostics = ''
    this._secrets = []
  }

  get diagnostics() {
    return this._redact(this._diagnostics)
  }

  getState() {
    const run = this._run
    return {
      state: !run ? 'stopped' : run.state === 'failed' ? 'stopping' : run.state,
      pid: run && run.child && !run.exited ? (run.child.pid || null) : null,
      mapId: this.mapId
    }
  }

  _redact(value) {
    let result = String(value)
    for (const secret of this._secrets) result = result.split(secret).join('[redacted]')
    return result.slice(-DIAGNOSTIC_LIMIT)
  }

  _error(message) {
    return new Error(this._redact(message))
  }

  start() {
    if (this._run) {
      if (this._run.state === 'starting') return this._run.startPromise
      if (this._run.state === 'running') return Promise.resolve({ ...this._run.session })
      return (this._run.stopPromise || this.stop()).then(() => this.start())
    }

    const ownerToken = randomBytes(32).toString('hex')
    const observerToken = randomBytes(32).toString('hex')
    this._diagnostics = ''
    this._secrets = [ownerToken, observerToken]
    const run = { state: 'starting', child: null, exited: false, startupTimer: null, session: null }
    run.startPromise = new Promise((resolve, reject) => {
      run.resolve = resolve
      run.reject = reject
    })
    run.exitPromise = new Promise(resolve => { run.resolveExit = resolve })
    this._run = run

    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    // The child executes our built entry, without inherited Node preload/debug flags.
    delete env.NODE_OPTIONS
    delete env.NODE_PATH
    delete env.NODE_TEST_CONTEXT
    try {
      run.child = this._fork(this.entryPath, [], {
        cwd: path.resolve(__dirname, '..'),
        execPath: process.execPath,
        execArgv: [],
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      })
    } catch (error) {
      this._run = null
      run.reject(this._error(`Unable to start local server: ${error.message}`))
      return run.startPromise
    }

    const child = run.child
    run.onData = chunk => {
      this._diagnostics = (this._diagnostics + String(chunk)).slice(-DIAGNOSTIC_LIMIT)
    }
    run.onError = error => {
      if (run.state === 'starting') this._failStartup(run, this._error(`Local server process failed: ${error.message}`))
      else if (run.state === 'running') {
        this.emit('failure', this._error(`Local server process failed: ${error.message}`))
        this.stop().catch(failure => this.emit('failure', failure))
      }
    }
    run.onExit = (code, signal) => {
      run.exited = true
      run.resolveExit()
      if (run.state === 'starting') {
        this._failStartup(run, this._error(`Local server exited before becoming ready (code ${code}, signal ${signal || 'none'})`))
      } else if (run.state === 'running') {
        this._cleanup(run)
        this.emit('failure', this._error(`Local server exited unexpectedly (code ${code}, signal ${signal || 'none'})`))
      }
    }
    // A failed exec emits error and close, without an exit event or a PID.
    run.onClose = (code, signal) => {
      if (!run.exited) run.onExit(code, signal)
    }
    run.onMessage = message => {
      if (run.state !== 'starting' || !message || typeof message !== 'object') return
      if (message.type === 'error') {
        this._failStartup(run, this._error(`Local server startup failed: ${String(message.message || 'Unknown error')}`))
        return
      }
      if (message.type !== 'ready') return
      let url
      try { url = new URL(message.url) } catch (_) { /* Invalid readiness is handled below. */ }
      if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || Number(url.port) <= 0 ||
          url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
          message.protocolVersion !== 1 || message.mapId !== this.mapId) {
        this._failStartup(run, this._error('Local server sent invalid readiness information'))
        return
      }
      clearTimeout(run.startupTimer)
      run.state = 'running'
      run.session = {
        url: url.origin,
        token: ownerToken,
        observerToken,
        protocolVersion: 1,
        pid: child.pid,
        mapId: this.mapId
      }
      run.resolve({ ...run.session })
    }
    run.onSpawn = () => {
      if (run.state !== 'starting') return
      child.send({ type: 'start', config: { dataPath: this.dataPath, mapId: this.mapId,
        ...(this.checkpointPath ? { checkpointPath: this.checkpointPath } : {}), ownerToken, observerToken } }, error => {
        if (error && run.state === 'starting') this._failStartup(run, this._error(`Unable to configure local server: ${error.message}`))
      })
    }
    child.on('error', run.onError)
    child.once('exit', run.onExit)
    child.once('close', run.onClose)
    child.on('message', run.onMessage)
    child.once('spawn', run.onSpawn)
    if (child.stdout) child.stdout.on('data', run.onData)
    if (child.stderr) child.stderr.on('data', run.onData)
    run.startupTimer = setTimeout(() => {
      this._failStartup(run, this._error('Local server startup timed out'))
    }, this._startupTimeout)
    return run.startPromise
  }

  _failStartup(run, error) {
    if (run.state !== 'starting') return
    run.state = 'failed'
    clearTimeout(run.startupTimer)
    this.stop().then(() => run.reject(error), cleanupError => {
      run.reject(this._error(`${error.message}; ${cleanupError.message}`))
    })
  }

  _cleanup(run) {
    clearTimeout(run.startupTimer)
    const child = run.child
    if (child) {
      child.off('error', run.onError)
      child.off('exit', run.onExit)
      child.off('close', run.onClose)
      child.off('message', run.onMessage)
      child.off('spawn', run.onSpawn)
      if (child.stdout) child.stdout.off('data', run.onData)
      if (child.stderr) child.stderr.off('data', run.onData)
    }
    if (this._run === run) this._run = null
  }

  stop() {
    const run = this._run
    if (!run) return Promise.resolve()
    if (run.stopPromise) return run.stopPromise
    const cancelledStartup = run.state === 'starting'
    run.state = 'stopping'
    clearTimeout(run.startupTimer)
    run.stopPromise = (async () => {
      if (!run.exited && run.child.connected) {
        try { run.child.send({ type: 'stop' }, () => {}) } catch (_) { /* A closed IPC pipe still needs process cleanup. */ }
      }
      if (!await waitForExit(run, this._stopTimeout)) {
        run.child.kill('SIGTERM')
        if (!await waitForExit(run, this._killTimeout)) {
          run.child.kill('SIGKILL')
          if (!await waitForExit(run, this._killTimeout)) throw this._error('Local server did not exit after forced termination')
        }
      }
      this._cleanup(run)
    })()
    run.stopPromise.then(() => {
      if (cancelledStartup) run.reject(this._error('Local server startup was cancelled'))
    }, error => {
      if (cancelledStartup) run.reject(error)
      // Retain ownership so a failed stop can be retried instead of losing the child.
      run.stopPromise = null
    })
    return run.stopPromise
  }
}

module.exports = { LocalServerHost }
