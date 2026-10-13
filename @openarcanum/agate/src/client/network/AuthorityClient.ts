import type { Socket } from 'socket.io-client'
import type { AuthoritySession, AuthoritySnapshot, CommandAck, MovementAck, JoinAck } from '../ClientTypes'
import { isRecord, isInteger, errorMessage } from '../SessionTypes'
import { io } from 'socket.io-client'

// This connection carries intentions and server state. Rendering never writes
// through it directly to the simulation's entities or clock.
export default class AuthorityClient {
  declare session: AuthoritySession
  declare onSnapshot: (snapshot: AuthoritySnapshot) => void
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

  constructor(session: AuthoritySession, { onSnapshot, onError, socketFactory = io }: { onSnapshot: (snapshot: AuthoritySnapshot) => void; onError: (error: Error) => void; socketFactory?: typeof io }) {
    this.session = session
    this.onSnapshot = onSnapshot
    this.onError = onError
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
    if (this.session.protocolVersion !== 1) throw new Error('Unsupported local server protocol')
    this.socket = this.socketFactory(this.session.url, {
      auth: { version: 1, token: this.session.token },
      transports: ['websocket'], autoConnect: false, reconnection: false, timeout: 10000
    })
    this.socket.on('authority:snapshot', snapshot => this.receiveSnapshot(snapshot))
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
      const joined: unknown = await this.wait(() => this.socket.timeout(10000).emitWithAck('authority:join', { version: 1 }))
      if (!isRecord(joined) || !joined.ok || joined.version !== 1 || joined.role !== 'owner') {
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
      if (!isRecord(snapshot) || snapshot.version !== 1 || !isInteger(snapshot.revision) ||
          snapshot.revision < 0 || !Array.isArray(snapshot.actors)) {
        throw new Error('Invalid authoritative world snapshot')
      }
      if (this.snapshot && snapshot.revision <= this.snapshot.revision) return
      this.snapshot = snapshot as unknown as AuthoritySnapshot
      this.onSnapshot(this.snapshot)
    } catch (error) { this.fail(error instanceof Error ? error : new Error(errorMessage(error))) }
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
      version: 1, id, actorId, type, ...intention
    }))
    if (!isRecord(result) || !result.ok) {
      const message = isRecord(result) ? result.message || result.reason : undefined
      const error = Object.assign(new Error(typeof message === 'string' ? message : 'The server rejected the action'), { code: isRecord(result) ? result.code : undefined })
      throw error
    }
    if (result.id !== id) throw new Error('Local server acknowledged a different command')
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
    this.closeError = error
    for (const pending of this.pending) pending.reject(error)
    this.pending.clear()
    this.socket?.removeAllListeners()
    this.socket?.disconnect()
  }
}
