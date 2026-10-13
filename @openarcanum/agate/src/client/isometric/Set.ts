// A Set is a collection of unique elements; this API predates native Set.
export default class Set<T extends object> {
  entries: T[] = []
  constructor(elements: T[] = []) { for (const value of elements) this.set(value) }
  set(value: T): this { if (!this.entries.includes(value)) this.entries.push(value); return this }
  add(value: T): this { return this.set(value) }
  get<K extends keyof T>(property: K, value: T[K]): T | undefined { return this.entries.find(entry => entry[property] === value) }
  getArray(): T[] { return this.entries.slice() }
  delete(value: T): this { const index = this.entries.indexOf(value); if (index > -1) this.entries.splice(index, 1); return this }
  dump(): void { console.group('Set'); for (const entry of this.entries) console.log(entry); console.groupEnd() }
  each(callback: (value: T, index: number) => unknown, callbackScope?: unknown): this {
    const entries = this.entries.slice()
    for (let i = 0; i < entries.length; i++) if (callback.call(callbackScope, entries[i], i) === false) break
    return this
  }
  iterate(callback: (value: T, index: number) => unknown, callbackScope?: unknown): this {
    for (let i = 0, length = this.entries.length; i < length; i++) if (callback.call(callbackScope, this.entries[i], i) === false) break
    return this
  }
  iterateLocal<K extends keyof T>(callbackKey: K, ...args: unknown[]): this {
    for (const entry of this.entries) {
      const callback = entry[callbackKey]
      if (typeof callback !== 'function') throw new TypeError(`Set entry ${String(callbackKey)} is not callable.`)
      Reflect.apply(callback, entry, args)
    }
    return this
  }
  clear(): this { this.entries.length = 0; return this }
  contains(value: T): boolean { return this.entries.includes(value) }
  union(set: Set<T>): Set<T> { return new Set([...set.entries, ...this.entries]) }
  intersect(set: Set<T>): Set<T> { return new Set(this.entries.filter(value => set.contains(value))) }
  difference(set: Set<T>): Set<T> { return new Set(this.entries.filter(value => !set.contains(value))) }
  get size(): number { return this.entries.length }
  set size(value: number) { this.entries.length = value }
}
