import { fork as forkProcess, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { errorMessage } from './desktop-contracts.cjs'

export interface LocalSessionDescriptor {
  url: string
  token: string
  observerToken: string
  protocolVersion: 2
  pid: number | undefined
  mapId: string
}

export interface LocalServerState {
  state: 'stopped' | 'starting' | 'running' | 'stopping'
  pid: number | null
  mapId: string
}

export type InitialScriptFlags = Readonly<Record<string, Readonly<Record<number, 0 | 1>>>>

/** Trusted host bootstrap data; no renderer or socket command can set flags. */
export function validateInitialScriptFlags(value: unknown): InitialScriptFlags {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 64) throw new Error('Invalid initial script flags')
  const output: Record<string, Readonly<Record<number, 0 | 1>>> = {}
  for (const [namespace, raw] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9_-]*$/.test(namespace) || !raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 65536) throw new Error('Invalid initial script flag namespace')
    const flags: Record<number, 0 | 1> = {}
    for (const [key, state] of Object.entries(raw)) {
      const id = Number(key)
      if (!/^(0|[1-9][0-9]*)$/.test(key) || !Number.isSafeInteger(id) || id > 65535 || (state !== 0 && state !== 1)) throw new Error('Invalid initial script flag value')
      flags[id] = state
    }
    output[namespace] = Object.freeze(flags)
  }
  return Object.freeze(output)
}

export interface LocalServerOptions {
  entryPath: string
  dataPath: string
  mapId: string
  checkpointPath?: string
  scriptManifestPath?: string
  initialScriptFlags?: InitialScriptFlags
  fork?: typeof forkProcess
  startupTimeoutMs?: number
  stopTimeoutMs?: number
  killTimeoutMs?: number
}

interface ServerRun {
  state: 'starting' | 'running' | 'stopping' | 'failed'
  child: ChildProcess | null
  exited: boolean
  startupTimer: ReturnType<typeof setTimeout> | null
  session: LocalSessionDescriptor | null
  startPromise: Promise<LocalSessionDescriptor>
  stopPromise?: Promise<void> | null
  exitPromise: Promise<void>
  resolve: (session: LocalSessionDescriptor) => void
  reject: (error: Error) => void
  resolveExit: () => void
  onData?: (chunk: Buffer | string) => void
  onError?: (error: Error) => void
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
  onClose?: (code: number | null, signal: NodeJS.Signals | null) => void
  onMessage?: (message: unknown) => void
  onSpawn?: () => void
}

function createRun(): ServerRun {
  let resolve!: ServerRun['resolve']
  let reject!: ServerRun['reject']
  const startPromise = new Promise<LocalSessionDescriptor>((accept, fail) => { resolve = accept; reject = fail })
  let resolveExit!: ServerRun['resolveExit']
  const exitPromise = new Promise<void>(accept => { resolveExit = accept })
  return { state: 'starting', child: null, exited: false, startupTimer: null, session: null,
    startPromise, exitPromise, resolve, reject, resolveExit }
}

function isMessage(message: unknown): message is Record<string, unknown> {
  return message !== null && typeof message === 'object'
}

const DIAGNOSTIC_LIMIT = 16 * 1024

function positiveTimeout(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function waitForExit(run: ServerRun, timeout: number): Promise<boolean> {
  if (run.exited) return Promise.resolve(true)
  return new Promise<boolean>(resolve => {
    const timer = setTimeout(() => resolve(false), timeout)
    run.exitPromise.then(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/** Owns the private local server process; credentials travel only over its IPC pipe. */
export class LocalServerHost extends EventEmitter<{ failure: [Error] }> {
  declare readonly entryPath: string
  declare readonly dataPath: string
  declare readonly mapId: string
  declare readonly checkpointPath: string | undefined
  declare readonly scriptManifestPath: string | undefined
  declare readonly initialScriptFlags: InitialScriptFlags | undefined
  declare private readonly _fork: typeof forkProcess
  declare private readonly _startupTimeout: number
  declare private readonly _stopTimeout: number
  declare private readonly _killTimeout: number
  declare private _run: ServerRun | null
  declare private _diagnostics: string
  declare private _secrets: string[]

  constructor({ entryPath, dataPath, mapId, checkpointPath, scriptManifestPath, initialScriptFlags, fork = forkProcess, startupTimeoutMs, stopTimeoutMs, killTimeoutMs }: LocalServerOptions) {
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
    if (scriptManifestPath !== undefined && (typeof scriptManifestPath !== 'string' || !scriptManifestPath)) {
      throw new Error('A configured script manifest path must be a nonempty string')
    }
    this.scriptManifestPath = scriptManifestPath === undefined ? undefined : path.resolve(scriptManifestPath)
    this.initialScriptFlags = initialScriptFlags === undefined ? undefined : validateInitialScriptFlags(initialScriptFlags)
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

  getState(): LocalServerState {
    const run = this._run
    return {
      state: !run ? 'stopped' : run.state === 'failed' ? 'stopping' : run.state,
      pid: run && run.child && !run.exited ? (run.child.pid || null) : null,
      mapId: this.mapId
    }
  }

  private _redact(value: unknown): string {
    let result = String(value)
    for (const secret of this._secrets) result = result.split(secret).join('[redacted]')
    return result.slice(-DIAGNOSTIC_LIMIT)
  }

  private _error(message: unknown): Error {
    return new Error(this._redact(message))
  }

  start(): Promise<LocalSessionDescriptor> {
    if (this._run) {
      if (this._run.state === 'starting') return this._run.startPromise
      if (this._run.state === 'running') return Promise.resolve({ ...this._run.session! })
      return (this._run.stopPromise || this.stop()).then(() => this.start())
    }

    const ownerToken = randomBytes(32).toString('hex')
    const observerToken = randomBytes(32).toString('hex')
    this._diagnostics = ''
    this._secrets = [ownerToken, observerToken]
    const run = createRun()
    this._run = run

    const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
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
      run.reject(this._error(`Unable to start local server: ${errorMessage(error)}`))
      return run.startPromise
    }

    const child = run.child
    run.onData = chunk => {
      this._diagnostics = (this._diagnostics + String(chunk)).slice(-DIAGNOSTIC_LIMIT)
    }
    run.onError = error => {
      if (run.state === 'starting') this._failStartup(run, this._error(`Local server process failed: ${errorMessage(error)}`))
      else if (run.state === 'running') {
        this.emit('failure', this._error(`Local server process failed: ${errorMessage(error)}`))
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
      if (!run.exited) run.onExit?.(code, signal)
    }
    run.onMessage = message => {
      if (run.state !== 'starting' || !isMessage(message)) return
      if (message.type === 'error') {
        this._failStartup(run, this._error(`Local server startup failed: ${String(message.message || 'Unknown error')}`))
        return
      }
      if (message.type !== 'ready') return
      let url: URL | undefined
      try { if (typeof message.url === 'string') url = new URL(message.url) } catch (_) { /* Invalid readiness is handled below. */ }
      if (!url || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || Number(url.port) <= 0 ||
          url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
          message.protocolVersion !== 2 || message.mapId !== this.mapId) {
        this._failStartup(run, this._error('Local server sent invalid readiness information'))
        return
      }
      if (run.startupTimer) clearTimeout(run.startupTimer)
      run.state = 'running'
      run.session = {
        url: url.origin,
        token: ownerToken,
        observerToken,
        protocolVersion: 2,
        pid: child.pid,
        mapId: this.mapId
      }
      run.resolve({ ...run.session })
    }
    run.onSpawn = () => {
      if (run.state !== 'starting') return
      child.send({ type: 'start', config: { dataPath: this.dataPath, mapId: this.mapId,
        ...(this.scriptManifestPath ? { scriptManifestPath: this.scriptManifestPath } : {}),
        ...(this.initialScriptFlags ? { initialScriptFlags: this.initialScriptFlags } : {}),
        ...(this.checkpointPath ? { checkpointPath: this.checkpointPath } : {}), ownerToken, observerToken } }, error => {
        if (error && run.state === 'starting') this._failStartup(run, this._error(`Unable to configure local server: ${errorMessage(error)}`))
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

  private _failStartup(run: ServerRun, error: Error): void {
    if (run.state !== 'starting') return
    run.state = 'failed'
    if (run.startupTimer) clearTimeout(run.startupTimer)
    this.stop().then(() => run.reject(error), cleanupError => {
      run.reject(this._error(`${errorMessage(error)}; ${errorMessage(cleanupError)}`))
    })
  }

  private _cleanup(run: ServerRun): void {
    if (run.startupTimer) clearTimeout(run.startupTimer)
    const child = run.child
    if (child) {
      if (run.onError) child.off('error', run.onError)
      if (run.onExit) child.off('exit', run.onExit)
      if (run.onClose) child.off('close', run.onClose)
      if (run.onMessage) child.off('message', run.onMessage)
      if (run.onSpawn) child.off('spawn', run.onSpawn)
      if (child.stdout && run.onData) child.stdout.off('data', run.onData)
      if (child.stderr && run.onData) child.stderr.off('data', run.onData)
    }
    if (this._run === run) this._run = null
  }

  stop(): Promise<void> {
    const run = this._run
    if (!run) return Promise.resolve()
    if (run.stopPromise) return run.stopPromise
    const cancelledStartup = run.state === 'starting'
    run.state = 'stopping'
    if (run.startupTimer) clearTimeout(run.startupTimer)
    run.stopPromise = (async () => {
      if (!run.exited && run.child?.connected) {
        try { run.child.send({ type: 'stop' }, () => {}) } catch (_) { /* A closed IPC pipe still needs process cleanup. */ }
      }
      if (!await waitForExit(run, this._stopTimeout)) {
        run.child?.kill('SIGTERM')
        if (!await waitForExit(run, this._killTimeout)) {
          run.child?.kill('SIGKILL')
          if (!await waitForExit(run, this._killTimeout)) throw this._error('Local server did not exit after forced termination')
        }
      }
      this._cleanup(run)
    })()
    run.stopPromise.then(() => {
      if (cancelledStartup) run.reject(this._error('Local server startup was cancelled'))
    }, error => {
      if (cancelledStartup) run.reject(error instanceof Error ? error : this._error(error))
      // Retain ownership so a failed stop can be retried instead of losing the child.
      run.stopPromise = null
    })
    return run.stopPromise
  }
}
