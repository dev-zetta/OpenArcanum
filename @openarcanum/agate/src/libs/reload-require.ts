import path from 'node:path'
import {EventEmitter} from 'node:events'
const events = new EventEmitter()
type Listener = (previous: unknown, current: unknown) => void
interface Reload extends Pick<EventEmitter, 'addListener' | 'emit' | 'on' | 'once' | 'removeAllListeners' | 'removeListener' | 'setMaxListeners' | 'listeners'> {
  (file: string): void
  watch(file: string, callback: Listener): void
  require(object: Record<string, unknown>, key: string, file: string, callback?: Listener): void
  event(file?: string): string
}
function createReload(parentModule: Pick<NodeJS.Module, 'filename'>): Reload {
  const parentDir = path.dirname(parentModule.filename)
  const resolve = (file: string): string => file.startsWith('.') ? require.resolve(path.resolve(parentDir, file)) : file
  const reload = ((file: string) => {
    const resolved = resolve(file)
    delete require.cache[resolved]
    events.emit('reload', resolved)
    events.emit('reload:' + resolved)
  }) as Reload
  reload.watch = (file, callback) => {
    const resolved = resolve(file)
    let current: unknown = require(resolved)
    callback(undefined, current)
    events.on('reload:' + resolved, () => {
      const previous = current
      current = require(resolved)
      callback(previous, current)
    })
  }
  reload.require = (object, key, file, callback) => reload.watch(file, (previous, current) => {
    object[key] = current
    callback?.(previous, current)
  })
  reload.event = file => file ? 'reload:' + resolve(file) : 'reload'
  Object.assign(reload, {
    addListener: events.addListener.bind(events), emit: events.emit.bind(events),
    on: events.on.bind(events), once: events.once.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events), removeListener: events.removeListener.bind(events),
    setMaxListeners: events.setMaxListeners.bind(events), listeners: events.listeners.bind(events)
  })
  return reload
}
module.exports = createReload
export type {Reload}
