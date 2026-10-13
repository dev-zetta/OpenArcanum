/** Reuses objects with an init method while retaining their constructor and
 * initialization parameter types. The historical aquire spelling is public. */
type InitParameter<T> = T extends { init(parameter: infer P, ...rest: never[]): unknown } ? P : never
export default class ObjectPool<T extends object, C extends unknown[] = []> {
  freeList: T[] = []
  count = 0
  T: new(...parameters: C) => T
  constructParams: C
  constructor(Constructor: new(...parameters: C) => T, ...parameters: C) {
    this.T = Constructor; this.constructParams = parameters; this.expand(100)
  }
  aquire(parameters: InitParameter<T>): T {
    if (!this.freeList.length) this.expand(Math.round(this.count * 0.2) + 1)
    const item = this.freeList.pop()!
    const initialize: unknown = Reflect.get(item, 'init')
    if (typeof initialize !== 'function') throw new TypeError('Pooled objects require an init method.')
    Reflect.apply(initialize, item, [parameters])
    return item
  }
  release(item: T): void { this.freeList.push(item) }
  expand(count: number): void { for (let n = 0; n < count; n++) this.freeList.push(new this.T(...this.constructParams)); this.count += count }
  totalSize(): number { return this.count }
  totalFree(): number { return this.freeList.length }
  totalUsed(): number { return this.count - this.freeList.length }
}
