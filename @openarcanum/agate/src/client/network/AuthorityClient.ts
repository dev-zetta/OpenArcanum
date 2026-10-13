import type { AuthorityPresentation } from '../ClientScriptTypes'
import type { Socket } from 'socket.io-client'
import type { AuthoritySession, AuthoritySnapshot, CommandAck, MovementAck, JoinAck } from '../ClientTypes'
import { isRecord, isInteger, errorMessage } from '../SessionTypes'
import { io } from 'socket.io-client'

// This connection carries intentions and server state. Rendering never writes
// through it directly to the simulation's entities or clock.
export default class AuthorityClient {
  declare session: AuthoritySession
  declare onSnapshot: (snapshot: AuthoritySnapshot) => void
  declare onPresentation?: (event: AuthorityPresentation) => void
  presentationQueue: AuthorityPresentation[] = []
  presentationSequence = 0
  declare onError: (error: Error) => void
  declare socketFactory: typeof io
  declare nextId: number
  declare closed: boolean
  declare snapshot: AuthoritySnapshot | null
  declare pending: Set<{ reject(reason: unknown): void }>
  declare startPromise: Promise<JoinAck> | undefined
  declare socket: Socket
  declare actorId: string
  declare closeError: InstanceType<typeof Error>

  constructor(session: AuthoritySession, { onSnapshot, onError, onPresentation, socketFactory = io }: { onSnapshot: (snapshot: AuthoritySnapshot) => void; onError: (error: Error) => void; onPresentation?: (event: AuthorityPresentation) => void; socketFactory?: typeof io }) {
    this.session = session
    this.onSnapshot = onSnapshot
    this.onError = onError
    this.onPresentation = onPresentation
    this.socketFactory = socketFactory
    this.nextId = 1
    this.closed = false
    this.snapshot = null
    this.pending = new Set()
  }

  start() {
    if (this.closed) return Promise.reject(this.closeError)
    if (!this.startPromise) this.startPromise = this.connectAndJoin()
    return this.startPromise
  }

  async connectAndJoin(): Promise<JoinAck> {
    if (this.session.protocolVersion !== 2) throw new Error('Unsupported local server protocol')
    this.socket = this.socketFactory(this.session.url, {
      auth: { version: 2, token: this.session.token },
      transports: ['websocket'], autoConnect: false, reconnection: false, timeout: 10000
    })
    this.socket.on('authority:snapshot', snapshot => this.receiveSnapshot(snapshot))
    this.socket.on('authority:presentation', event => this.receivePresentation(event))
    this.socket.on('disconnect', reason => {
      if (!this.closed) this.fail(new Error(`Local server disconnected: ${reason}`))
    })
    try {
      await this.wait(() => new Promise<void>((resolve, reject) => {
        const connected = () => { this.socket.off('connect_error', failed); resolve() }
        const failed = (error: Error) => { this.socket.off('connect', connected); reject(error) }
        this.socket.once('connect', connected)
        this.socket.once('connect_error', failed)
        this.socket.connect()
      }))
      const joined: unknown = await this.wait(() => this.socket.timeout(10000).emitWithAck('authority:join', { version: 2 }))
      if (!isRecord(joined) || !joined.ok || joined.version !== 2 || joined.role !== 'owner') {
        throw new Error(isRecord(joined) && typeof joined.message === 'string' ? joined.message : 'Local server did not grant player ownership')
      }
      if (typeof joined.actorId !== 'string' || !joined.actorId ||
          !isInteger(joined.nextCommandId) || joined.nextCommandId < 1) {
        throw new Error('Local server supplied invalid player ownership information')
      }
      this.actorId = joined.actorId
      this.nextId = joined.nextCommandId
      this.receiveSnapshot(joined.snapshot)
      if (this.closed) throw this.closeError
      return joined as unknown as JoinAck
    } catch (error) {
      this.close()
      throw error
    }
  }

  receiveSnapshot(snapshot: unknown) {
    if (this.closed) return
    try {
      if (!isRecord(snapshot) || snapshot.version !== 2 || !isInteger(snapshot.revision) ||
          snapshot.revision < 0 || !Array.isArray(snapshot.actors) || !isInteger(snapshot.scriptEpoch) || snapshot.scriptEpoch < 1 ||
          !Array.isArray(snapshot.scriptObjects) || snapshot.scriptObjects.length > 4096 ||
          snapshot.scriptObjects.some((row: unknown) => !isRecord(row) || Object.keys(row).length !== 2 ||
            typeof row.id !== 'string' || !row.id || row.id.length > 1024 || typeof row.off !== 'boolean') ||
          new Set(snapshot.scriptObjects.map(row => row.id)).size !== snapshot.scriptObjects.length) {
        throw new Error('Invalid authoritative world snapshot')
      }
      if (this.snapshot && snapshot.revision <= this.snapshot.revision) return
      if (this.snapshot && snapshot.scriptEpoch < this.snapshot.scriptEpoch) throw new Error('Authoritative script epoch regressed')
      if (!this.snapshot || snapshot.scriptEpoch > this.snapshot.scriptEpoch) {
        this.presentationQueue.length = 0
        this.presentationSequence = 0
      }
      this.snapshot = snapshot as unknown as AuthoritySnapshot
      this.onSnapshot(this.snapshot)
      this.flushPresentation()
    } catch (error) { this.fail(error instanceof Error ? error : new Error(errorMessage(error))) }
  }

  receivePresentation(value: unknown): void {
    if (this.closed) return
    try {
      const allowed = ['version', 'epoch', 'sequence', 'revision', 'type', 'text', ...(isRecord(value) && Object.hasOwn(value, 'targetId') ? ['targetId'] : [])]
      if (!isRecord(value) || Object.keys(value).length !== allowed.length || !allowed.every(key => Object.hasOwn(value, key)) ||
          value.version !== 2 || value.type !== 'message' || !isInteger(value.epoch) || value.epoch < 1 ||
          !isInteger(value.sequence) || value.sequence < 1 || !isInteger(value.revision) || value.revision < 0 ||
          typeof value.text !== 'string' || !value.text.trim() || value.text.length > 4096 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.text) ||
          (Object.hasOwn(value, 'targetId') && (typeof value.targetId !== 'string' || !value.targetId || value.targetId.length > 1024))) {
        throw new Error('Invalid authoritative script presentation')
      }
      if (!this.snapshot || value.epoch !== this.snapshot.scriptEpoch || value.sequence <= this.presentationSequence) return
      this.presentationSequence = value.sequence
      this.presentationQueue.push(value as unknown as AuthorityPresentation)
      if (this.presentationQueue.length > 64) throw new Error('Too many pending script presentations')
      this.flushPresentation()
    } catch (error) { this.fail(error instanceof Error ? error : new Error(errorMessage(error))) }
  }

  private flushPresentation(): void {
    while (!this.closed && this.snapshot && this.presentationQueue.length) {
      const next = this.presentationQueue[0]
      if (next.revision > this.snapshot.revision) return
      this.presentationQueue.shift()
      if (next.epoch === this.snapshot.scriptEpoch) this.onPresentation?.(next)
    }
  }

  async move(actorId: string, target: number[]) {
    return this.command(actorId, 'move', { target }) as Promise<MovementAck>
  }

  async use(actorId: string, targetId: string) {
    return this.command(actorId, 'use', { targetId }) as Promise<MovementAck>
  }

  async inspect(actorId: string, targetId: string) {
    return this.command(actorId, 'inspect', { targetId })
  }

  async inventory(actorId: string) { return this.command(actorId, 'inventory', {}) }

  async take(actorId: string, targetId: string, itemId: string, expectedRevision: number) {
    return this.command(actorId, 'take', { targetId, itemId, expectedRevision })
  }

  async takeAll(actorId: string, targetId: string, expectedRevision: number) {
    return this.command(actorId, 'take-all', { targetId, expectedRevision })
  }

  async put(actorId: string, targetId: string, itemId: string, expectedRevision: number) {
    return this.command(actorId, 'put', { targetId, itemId, expectedRevision })
  }

  async pickup(actorId: string, targetId: string, expectedRevision: number) {
    return this.command(actorId, 'pickup', { targetId, expectedRevision })
  }

  async drop(actorId: string, itemId: string, expectedRevision: number) {
    return this.command(actorId, 'drop', { itemId, expectedRevision })
  }

  async talk(actorId: string, targetId: string) { return this.command(actorId, 'talk', { targetId }) }

  async reply(actorId: string, targetId: string, conversationId: string, optionId: string, expectedRevision: number) {
    return this.command(actorId, 'reply', { targetId, conversationId, optionId, expectedRevision })
  }

  async journal(actorId: string) { return this.command(actorId, 'journal', {}) }

  async character(actorId: string) { return this.command(actorId, 'character', {}) }

  async buyAttribute(actorId: string, statId: string, expectedRevision: number) {
    return this.command(actorId, 'buy-attribute', { statId, expectedRevision })
  }

  async save(actorId: string) { return this.command(actorId, 'save', {}) }

  async load(actorId: string) { return this.command(actorId, 'load', {}) }

  async pause(actorId: string) { return this.command(actorId, 'pause', {}) }

  async resume(actorId: string) { return this.command(actorId, 'resume', {}) }

  async command(actorId: string, type: string, intention: Record<string, unknown>): Promise<CommandAck> {
    if (this.closed || !this.socket?.connected) throw new Error('Local server is not connected')
    const id = this.nextId++
    const result: unknown = await this.wait(() => this.socket.timeout(10000).emitWithAck('authority:command', {
      version: 2, id, actorId, type, ...intention
    }))
    if (!isRecord(result) || !result.ok) {
      const message = isRecord(result) ? result.message || result.reason : undefined
      const error = Object.assign(new Error(typeof message === 'string' ? message : 'The server rejected the action'), { code: isRecord(result) ? result.code : undefined })
      throw error
    }
    if (result.version !== 2 || result.id !== id) throw new Error('Local server acknowledged a different command or protocol')
    return result as unknown as CommandAck
  }

  // Socket.IO acknowledgement timeouts are independent of component teardown.
  // Cancel every outstanding await immediately, including a connection that has
  // not emitted connect/connect_error yet, and consume any late acknowledgement.
  wait<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(this.closeError)
    return new Promise<T>((resolve, reject) => {
      const pending = { reject }
      this.pending.add(pending)
      try {
        Promise.resolve(operation()).then(value => {
          if (!this.pending.delete(pending)) return
          if (this.closed) reject(this.closeError)
          else resolve(value)
        }, error => {
          if (this.pending.delete(pending)) reject(error)
        })
      } catch (error) {
        this.pending.delete(pending)
        reject(error)
      }
    })
  }

  fail(error: Error) {
    if (this.closed) return
    this.close(error)
    this.onError(error)
  }

  close(error = new Error('Local authority client closed')) {
    if (this.closed) return
    this.closed = true
    this.presentationQueue.length = 0
    this.closeError = error
    for (const pending of this.pending) pending.reject(error)
    this.pending.clear()
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
  }
}
