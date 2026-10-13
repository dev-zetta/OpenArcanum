import type Action from './Action'
import type { EnumItem } from '../../misc/Enum'
import Utils from '../../misc/Utils'
import Enum from '../../misc/Enum'
import EventEmitter from '../../misc/EventEmitter'

export default class State extends EventEmitter {
  counter = 0
  actions = new Map<string, Action>()
  private timestamps = new Map<string, number>()
  static Flags = new Enum(['PreparingToAttack', 'Attacking', 'Moving', 'MovingToWaypoint', 'PlanningToMove', 'Running', 'IsDead'])
  constructor(counter = 0) { super(); this.init(counter) }
  init(counter = 0): void { this.counter = counter; this.actions = new Map(); this.timestamps.clear() }
  addAction(action: Action): void { this.actions.set(action.name, action); this.counter++ }
  removeAction(action: Action): void { action.parent = null; this.actions.delete(action.name); this.counter++ }
  set(state: EnumItem | EnumItem[]): void {
    if (Array.isArray(state)) { for (const flag of state) this.set(flag); return }
    this.timestamps.set(state.key, Utils.performance.now())
    this.counter++
  }
  has(state: EnumItem): boolean { return this.timestamps.has(state.key) }
  remove(state: EnumItem | EnumItem[]): boolean {
    if (Array.isArray(state)) { let removed = false; for (const flag of state) removed = this.remove(flag) || removed; return removed }
    const removed = this.timestamps.delete(state.key)
    this.counter++
    return removed
  }
  getElapsed(state: EnumItem): number { return Utils.performance.now() - (this.timestamps.get(state.key) ?? NaN) }
  getMissing<T extends EnumItem>(states: T[]): T[] { return states.filter(state => !this.has(state)) }
  hasAny(states: EnumItem[]): boolean { return states.some(state => this.has(state)) }
  clear(): void { this.timestamps.clear(); this.init() }
}
