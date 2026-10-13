import NativeEmitter from 'eventemitter3'

/** Dynamic event names are retained for mods; listeners carry their own tuple
 * contract, while queued values cross the event-name boundary as unknown. */
export default class EventEmitter extends NativeEmitter<string> {
  declare _queue: Record<string, unknown[][]>
  constructor() { super(); this._queue = {} }

  hookListener<Args extends unknown[]>(
    method: (topic: string, fn: (...args: Args) => unknown) => unknown,
    topic: string, fn: (...args: Args) => unknown, context?: object | null
  ): this {
    if (context) fn = fn.bind(context)
    method.call(this, topic, fn)
    const queued = this._queue[topic]
    if (queued) {
      console.debug(`Delivering queued event ${topic}`)
      for (const args of queued) fn(...args as Args)
      delete this._queue[topic]
    }
    return this
  }
  on<Args extends unknown[]>(topic: string, fn: (...args: Args) => unknown, context?: object | null): this {
    return this.hookListener(super.on, topic, fn, context)
  }
  once<Args extends unknown[]>(topic: string, fn: (...args: Args) => unknown, context?: object | null): this {
    return this.hookListener(super.once, topic, fn, context)
  }
  emit(topic: string, ...args: unknown[]): boolean {
    if (this.listenerCount(topic) > 0) return super.emit(topic, ...args)
    const queued = this._queue[topic]
    if (!queued) this._queue[topic] = [args.slice(1)]
    // Preserve the legacy queue's numeric-coercion rule during this migration.
    else if (Number(queued) < 3) queued.push(args.slice(1))
    return true
  }
  listen<Args extends unknown[]>(topic: string, fn: (...args: Args) => unknown, context?: object | null): this { return this.on(topic, fn, context) }
  listenOnce<Args extends unknown[]>(topic: string, fn: (...args: Args) => unknown, context?: object | null): this { return this.once(topic, fn, context) }
}
