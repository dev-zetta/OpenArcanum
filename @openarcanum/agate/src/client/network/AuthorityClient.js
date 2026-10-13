import { io } from 'socket.io-client'

// This connection carries intentions and server state. Rendering never writes
// through it directly to the simulation's entities or clock.
export default class AuthorityClient {
  constructor(session, { onSnapshot, onError, socketFactory = io }) {
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

  async connectAndJoin() {
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
      await this.wait(() => new Promise((resolve, reject) => {
        const connected = () => { this.socket.off('connect_error', failed); resolve() }
        const failed = error => { this.socket.off('connect', connected); reject(error) }
        this.socket.once('connect', connected)
        this.socket.once('connect_error', failed)
        this.socket.connect()
      }))
      const joined = await this.wait(() => this.socket.timeout(10000).emitWithAck('authority:join', { version: 1 }))
      if (!joined?.ok || joined.version !== 1 || joined.role !== 'owner') {
        throw new Error(joined?.message || 'Local server did not grant player ownership')
      }
      if (typeof joined.actorId !== 'string' || !joined.actorId ||
          !Number.isSafeInteger(joined.nextCommandId) || joined.nextCommandId < 1) {
        throw new Error('Local server supplied invalid player ownership information')
      }
      this.actorId = joined.actorId
      this.nextId = joined.nextCommandId
      this.receiveSnapshot(joined.snapshot)
      if (this.closed) throw this.closeError
      return joined
    } catch (error) {
      this.close()
      throw error
    }
  }

  receiveSnapshot(snapshot) {
    if (this.closed) return
    try {
      if (snapshot?.version !== 1 || !Number.isSafeInteger(snapshot.revision) ||
          snapshot.revision < 0 || !Array.isArray(snapshot.actors)) {
        throw new Error('Invalid authoritative world snapshot')
      }
      if (this.snapshot && snapshot.revision <= this.snapshot.revision) return
      this.snapshot = snapshot
      this.onSnapshot(snapshot)
    } catch (error) { this.fail(error) }
  }

  async move(actorId, target) {
    return this.command(actorId, 'move', { target })
  }

  async use(actorId, targetId) {
    return this.command(actorId, 'use', { targetId })
  }

  async inspect(actorId, targetId) {
    return this.command(actorId, 'inspect', { targetId })
  }

  async inventory(actorId) { return this.command(actorId, 'inventory', {}) }

  async take(actorId, targetId, itemId, expectedRevision) {
    return this.command(actorId, 'take', { targetId, itemId, expectedRevision })
  }

  async takeAll(actorId, targetId, expectedRevision) {
    return this.command(actorId, 'take-all', { targetId, expectedRevision })
  }

  async put(actorId, targetId, itemId, expectedRevision) {
    return this.command(actorId, 'put', { targetId, itemId, expectedRevision })
  }

  async pickup(actorId, targetId, expectedRevision) {
    return this.command(actorId, 'pickup', { targetId, expectedRevision })
  }

  async drop(actorId, itemId, expectedRevision) {
    return this.command(actorId, 'drop', { itemId, expectedRevision })
  }

  async talk(actorId, targetId) { return this.command(actorId, 'talk', { targetId }) }

  async reply(actorId, targetId, conversationId, optionId, expectedRevision) {
    return this.command(actorId, 'reply', { targetId, conversationId, optionId, expectedRevision })
  }

  async journal(actorId) { return this.command(actorId, 'journal', {}) }

  async character(actorId) { return this.command(actorId, 'character', {}) }

  async save(actorId) { return this.command(actorId, 'save', {}) }

  async load(actorId) { return this.command(actorId, 'load', {}) }

  async pause(actorId) { return this.command(actorId, 'pause', {}) }

  async resume(actorId) { return this.command(actorId, 'resume', {}) }

  async command(actorId, type, intention) {
    if (this.closed || !this.socket?.connected) throw new Error('Local server is not connected')
    const id = this.nextId++
    const result = await this.wait(() => this.socket.timeout(10000).emitWithAck('authority:command', {
      version: 1, id, actorId, type, ...intention
    }))
    if (!result?.ok) {
      const error = new Error(result?.message || result?.reason || 'The server rejected the action')
      error.code = result?.code
      throw error
    }
    if (result.id !== id) throw new Error('Local server acknowledged a different command')
    return result
  }

  // Socket.IO acknowledgement timeouts are independent of component teardown.
  // Cancel every outstanding await immediately, including a connection that has
  // not emitted connect/connect_error yet, and consume any late acknowledgement.
  wait(operation) {
    if (this.closed) return Promise.reject(this.closeError)
    return new Promise((resolve, reject) => {
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

  fail(error) {
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
