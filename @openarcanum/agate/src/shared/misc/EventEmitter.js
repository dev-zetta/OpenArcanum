//@flow

const eventemitter3 = require(`eventemitter3`) // EventEmitter

export default class EventEmitter extends eventemitter3 {
  _queue: Object // map of topics + args

  /**
   *
   */
  constructor() {
    super(...arguments)
    this._queue = {}
  }

  /**
   *
   * @param method
   * @param topic
   * @param fn
   * @param context
   */
  hookListener(
    method: Function,
    topic: string,
    fn: Function,
    context: ?Object
  ): EventEmitter {
    if (context) {
      fn = fn.bind(context)
    }

    method.call(this, topic, fn)

    let topics = this._queue[topic]
    if (topics) {
      console.error(`Delayed call of ${topic}`)
      for (let args of topics) {
        fn(...args)
      }
      delete this._queue[topic]
    }

    return this
  }

  /**
   *
   * @param topic
   * @param fn
   * @param context
   */
  on(topic: string, fn: Function, context: ?Object): EventEmitter {
    return this.hookListener(super.on, topic, fn, context)
  }

  /**
   *
   * @param topic
   * @param fn
   * @param context
   */
  once(topic: string, fn: Function, context: ?Object): EventEmitter {
    return this.hookListener(super.once, topic, fn, context)
  }

  /**
   *
   * @param topic
   * @param args
   * @returns {*}
   */
  emit(topic: string, ...args: any): boolean {
    if (this.listenerCount(topic) > 0) {
      return super.emit(topic, ...args)
    } else {
      if (!this._queue[topic]) {
        console.log(`Queuing call of ${topic}`)
        this._queue[topic] = [args.slice(1)]
      } else {
        if (this._queue[topic] < 3)
        this._queue[topic].push(args.slice(1))
      }
    }

    return true
  }

  /**
   *
   * @param args
   * @returns {*}
   */
  listen(...args: any) {
    return this.on(...args)
  }

  /**
   *
   * @param args
   * @returns {*}
   */
  listenOnce(...args: any) {
    return this.once(...args)
  }


}
