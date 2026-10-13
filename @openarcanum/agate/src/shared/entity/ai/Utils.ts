import Utils from '../../misc/Utils'
import type Entity from '../Entity'

export function didTargetEntityMove(entity: Entity): boolean {
  const target = entity.state.targetEntity
  return !!entity.critter && !!target && !entity.critter.movementPath.isTargetSame(target.base.location)
}

export function scorer(_value: number) {
  return function<Args extends unknown[], Result>(target: object, property: string | symbol, descriptor: TypedPropertyDescriptor<(...args: Args) => Result>) {
    const original = descriptor.value
    if (!original) return descriptor
    const Constructor = target.constructor
    const registered: unknown = Reflect.get(Constructor, 'Scorers')
    const scorers: unknown[] = Array.isArray(registered) ? registered : []
    scorers.push(original)
    Reflect.set(Constructor, 'Scorers', scorers)
    descriptor.value = function(this: unknown, ...args: Args): Result {
      const result = original.apply(this, args)
      console.log(`${String(property)}(${args}) = ${result}`)
      return result
    }
    return descriptor
  }
}

export class Interval {
  interval: number
  lastTime = 0
  constructor(seconds: number) { this.interval = seconds * 1000 }
  start(): void { this.lastTime = Utils.getCurrentTimestamp() }
  hit(): boolean {
    const now = Utils.getCurrentTimestamp()
    if (!this.lastTime) { this.lastTime = now; return false }
    if (now - this.lastTime >= this.interval) { this.lastTime = now; return true }
    return false
  }
}
