import { io } from 'socket.io-client'

const parser = require('socket.io-msgpack-parser');

export default class Socket {

  /**
   *
   * @param url
   * @param options
   */
  constructor(url: string, options: Object) {
    this.socket = io(url, {
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
