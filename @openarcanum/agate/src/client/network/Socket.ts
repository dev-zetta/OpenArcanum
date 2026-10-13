import { io, type Socket as IOSocket } from 'socket.io-client'
const parser = require('socket.io-msgpack-parser')
interface WrappedSocket extends IOSocket { wrapper: Socket; attach(...args: unknown[]): void }

/** Historical socket facade retained separately from the active local protocol. */
export default class Socket {
  declare socket: WrappedSocket
  declare wrapper: Socket
  constructor(url: string, options: Record<string, unknown>) {
    this.socket = io(url, { ...options, parser }) as WrappedSocket
    this.socket.wrapper = this
  }
  on<T extends unknown[]>(event: string, listener: (...args: T) => void) { this.socket.on(event, listener) }
  once<T extends unknown[]>(event: string, listener: (...args: T) => void) { this.socket.once(event, listener) }
  emit(event: string, ...args: unknown[]) { this.socket.emit(event, ...args) }
  attach(...args: unknown[]) { this.socket.attach(...args) }
  disconnect() { this.socket.disconnect() }
}
