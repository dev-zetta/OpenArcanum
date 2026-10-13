export interface VectorPoint { x: number; y: number }
export type VectorInput = number | readonly number[] | VectorPoint
export type VectorObserver = (current: Vec2, previous: Vec2 | null) => void

class Vec2 {
  declare x: number
  declare y: number
  declare observers: VectorObserver[] | undefined
  declare static precision: number
  declare static p: number

  constructor(x: VectorInput = 0, y = 0) {
    const pair = Vec2.pair(x, y)
    this.x = Vec2.clean(pair[0] || 0)
    this.y = Vec2.clean(pair[1] || 0)
  }

  private static pair(x: VectorInput, y?: number | boolean): [number, number] {
    if (typeof x === 'number') return [x, y as number]
    if (Array.isArray(x)) return [x[0], x[1]]
    const point = x as VectorPoint
    return [point.x, point.y]
  }

  change(fn: VectorObserver | Vec2 | null): this {
    if (typeof fn === 'function') {
      if (this.observers) this.observers.push(fn)
      else this.observers = [fn]
    } else if (this.observers?.length) {
      for (let i = this.observers.length - 1; i >= 0; i--) this.observers[i](this, fn)
    }
    return this
  }

  ignore(fn?: VectorObserver): this {
    if (this.observers) {
      if (!fn) this.observers = []
      else for (let i = this.observers.length - 1; i >= 0; i--) if (this.observers[i] === fn) this.observers.splice(i, 1)
    }
    return this
  }

  set(x: VectorInput, y?: number | boolean, notify?: boolean): this | undefined {
    if (typeof x !== 'number') notify = y as boolean | undefined
    const [px, py] = Vec2.pair(x, y)
    if (this.x === px && this.y === py) return this
    const previous = notify !== false && this.observers?.length ? this.clone() : null
    this.x = Vec2.clean(px)
    this.y = Vec2.clean(py)
    if (notify !== false) return this.change(previous)
  }

  toPlainObject(): VectorPoint { return { x: this.x, y: this.y } }
  zero(): this { return this.set(0, 0)! }
  clone(): this { return this.make(this.x, this.y) }
  private make(x: number, y: number): this {
    const Constructor = this.constructor as new(x: number, y: number) => this
    return new Constructor(x, y)
  }
  private result(x: number, y: number, returnNew?: boolean): this { return returnNew ? this.make(x, y) : this.set(x, y)! }
  negate(returnNew?: boolean): this { return this.result(-this.x, -this.y, returnNew) }

  add(x: VectorInput, y?: number | boolean, returnNew?: boolean): this {
    if (typeof x !== 'number') returnNew = y as boolean | undefined
    const [px, py] = Vec2.pair(x, y)
    return this.result(this.x + px, this.y + py, returnNew)
  }
  subtract(x: VectorInput, y?: number | boolean, returnNew?: boolean): this {
    if (typeof x !== 'number') returnNew = y as boolean | undefined
    const [px, py] = Vec2.pair(x, y)
    return this.result(this.x - px, this.y - py, returnNew)
  }
  multiply(x: VectorInput, y?: number | boolean, returnNew?: boolean): this {
    if (typeof x !== 'number') returnNew = y as boolean | undefined
    else if (typeof y !== 'number') { returnNew = y; y = x }
    const [px, py] = Vec2.pair(x, y)
    return this.result(this.x * px, this.y * py, returnNew)
  }
  rotate(r: number, inverse?: boolean, returnNew?: boolean): this {
    const direction = inverse ? -1 : 1, cos = Math.cos(r), sin = Math.sin(r)
    return this.result(cos * this.x - direction * sin * this.y, direction * sin * this.x + cos * this.y, returnNew)
  }
  length(): number { return Math.sqrt(this.lengthSquared()) }
  lengthSquared(): number { return this.x * this.x + this.y * this.y }
  distance(point: VectorPoint): number { const x = this.x - point.x, y = this.y - point.y; return Math.sqrt(x * x + y * y) }
  nearest<T extends VectorPoint>(others: readonly T[]): T | null {
    let distance = Number.MAX_VALUE, nearest: T | null = null
    for (let i = others.length - 1; i >= 0; i--) {
      const current = this.distance(others[i])
      if (current <= distance) { distance = current; nearest = others[i] }
    }
    return nearest
  }
  normalize(returnNew?: boolean): this {
    const length = this.length(), ratio = length < Number.MIN_VALUE ? 0 : 1 / length
    return this.result(this.x * ratio, this.y * ratio, returnNew)
  }
  equal(value: VectorInput, second?: number): boolean {
    const [x, y] = Vec2.pair(value, second)
    return Vec2.clean(x) === this.x && Vec2.clean(y) === this.y
  }
  abs(returnNew?: boolean): this { return this.result(Math.abs(this.x), Math.abs(this.y), returnNew) }
  min(point: VectorPoint, returnNew?: boolean): this { return this.result(Math.min(this.x, point.x), Math.min(this.y, point.y), returnNew) }
  max(point: VectorPoint, returnNew?: boolean): this { return this.result(Math.max(this.x, point.x), Math.max(this.y, point.y), returnNew) }
  clamp(low: VectorPoint, high: VectorPoint, returnNew?: boolean): this {
    const result = this.min(high, true).max(low)
    return returnNew ? result : this.set(result.x, result.y)!
  }
  lerp(vector: Vec2, amount: number, returnNew?: boolean): this {
    return this.add(vector.subtract(this, true).multiply(amount), returnNew)
  }
  skew(returnNew?: boolean): this { return this.result(-this.y, this.x, returnNew) }
  dot(point: VectorPoint): number { return Vec2.clean(this.x * point.x + point.y * this.y) }
  perpDot(point: VectorPoint): number { return Vec2.clean(this.x * point.y - this.y * point.x) }
  angleTo(point: VectorPoint): number { return Math.atan2(this.perpDot(point), this.dot(point)) }
  divide(x: VectorInput, y?: number | boolean, returnNew?: boolean): this {
    if (typeof x !== 'number') returnNew = y as boolean | undefined
    else if (typeof y !== 'number') { returnNew = y; y = x }
    const [px, py] = Vec2.pair(x, y)
    if (px === 0 || py === 0) throw new Error('division by zero')
    if (isNaN(px) || isNaN(py)) throw new Error('NaN detected')
    return this.result(this.x / px, this.y / py, returnNew)
  }
  isPointOnLine(start: VectorPoint, end: VectorPoint): boolean {
    return (start.y - this.y) * (start.x - end.x) === (start.y - end.y) * (start.x - this.x)
  }
  toArray(): [number, number] { return [this.x, this.y] }
  fromArray(array: readonly number[]): this { return this.set(array[0], array[1])! }
  toJSON(): VectorPoint { return this.toPlainObject() }
  toString(): string { return `(${this.x}, ${this.y})` }
  static fromArray<T extends Vec2>(array: readonly number[], Constructor?: new(x: number, y: number) => T): T | Vec2 {
    return new (Constructor || Vec2)(array[0], array[1])
  }
  static clean(value: number): number {
    if (isNaN(value)) throw new Error('NaN detected')
    if (!isFinite(value)) throw new Error('Infinity detected')
    return Math.round(value) === value ? value : Math.round(value * Vec2.p) / Vec2.p
  }
}
Vec2.precision = 8
Vec2.p = Math.pow(10, Vec2.precision)
export default Vec2
