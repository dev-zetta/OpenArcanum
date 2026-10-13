import {Server, type ServerOptions, type Socket as PeerSocket} from 'socket.io'
import type {Server as HttpServer} from 'node:http'
const parser: NonNullable<ServerOptions['parser']> = require('socket.io-msgpack-parser')
/** Listening socket wrapper. Connected peers use Socket.IO's own Socket type. */
export default class Socket {
  declare socket: Server
  constructor(server?: HttpServer | number, options: Partial<ServerOptions> = {}) {
    this.socket = server === undefined ? new Server({...options, parser}) : new Server(server, {...options, parser})
  }
  on(name: 'connection', listener: (peer: PeerSocket) => void): void { this.socket.on(name, listener) }
  once(name: 'connection', listener: (peer: PeerSocket) => void): void { this.socket.once(name, listener) }
  emit(name: string, payload: unknown): boolean { return this.socket.emit(name, payload) }
  attach(server: HttpServer | number): void { this.socket.attach(server) }
  async close(): Promise<void> { await this.socket.close() }
}
