/* global AGate */

const events = AGate.requireNode('events')

export class EventEmitter extends events {

  _queue = {}

  /**
   *
   */
  constructor() {
    super(...arguments)
  }

  on(topic, fn) {
    super.on(topic, fn)

    let topics = this._queue[topic]
    if(topics) {
      console.log(`Delayed call of ${topic}`)
      for (let item of topics) {
        fn.apply(this, item)
      }
      delete this._queue[topic]
    }
  }

  emit(topic, ...args) {
    if(this.listenerCount(topic) > 0) {
      return super.emit(topic, ...args)
    } else {
      console.log(`Queuing call of ${topic}`)
      if (!this._queue[topic]) {
        this._queue[topic] = [args.slice(1)]
      } else {
        this._queue[topic].push(args.slice(1))
      }
    }
  }

  /**
   *
   * @param arg
   * @returns {*}
   */
  listen = (...args) => this.on(...args)

  /**
   *
   * @param arg
   * @returns {*}
   */
  listenOnce = (...args) => this.once(...args)

  /**
   *
   * @param name
   * @param args
   * @returns {EventEmitter}
   */
  listenUI = (name, listener) => this.on(`ui.${name}`, listener)

  /**
   *
   * @param name
   * @param args
   * @returns {EventEmitter}
   */
  listenOnceUI = (name, listener) => this.once(`ui.${name}`, listener)

  /**
   *
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitUI = (name, ...args) => this.emit(`ui.${name}`, ...args)

}
