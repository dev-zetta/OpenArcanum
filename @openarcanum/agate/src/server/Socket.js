
const parser = require('socket.io-msgpack-parser');

import { Server } from 'socket.io'


/**
 * https://socket.io/docs/server-api/#new-Server-httpServer-options
 */
export default class Socket {
  socket: io

  /**
   *
   * @param server
   * @param options
   */
  constructor(server: Object, options: Object) {
    this.socket = new Server(server, {
      ...options,
     parser: parser
    });

    this.socket.wrapper = this
  }

  on(...args) {this.socket.on(...args)}
  once(...args) {this.socket.once(...args)}
  emit(...args) {this.socket.emit(...args)}
  attach(...args) {this.socket.attach(...args)}
}
