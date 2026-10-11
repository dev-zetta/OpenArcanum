// @flow

import Utils from '../../misc/Utils'
import type Action from './Action'
import Enum from '../../misc/Enum'
import EventEmitter from '../../misc/EventEmitter'

export default class State extends EventEmitter {
  counter: number
  actions: Map<string, Action>

  static Flags = new Enum([
    `PreparingToAttack`, // 1
    `Attacking`, // 2
    `Moving`, // 4
    `MovingToWaypoint`, // 8
    `PlanningToMove`, // 16,
    `Running`,
    `IsDead`
  ])

  /**
   *
   */
  constructor(counter: number = 0) {
    super()
  }

  init(counter: number = 0) {
    this.counter = counter
    this.actions = new Map()
  }

  // get currentAction(): Action {
  //   return this.actions[this.actions.length - 1]
  // }
  //
  // get lastAction(): Action {
  //   return this.actions[this.actions.length - 2]
  // }

  addAction(action: Action) {
    this.actions.set(action.name, action)
    this.counter++
  }

  removeAction(action: Action) {
    action.parent = null
    this.actions.delete(action.name)
    this.counter++
  }

  /**
   *
   * @param state
   */
  set(state: Object) {
    if (Utils.isArray(state)) {
      for (let i = 0; i < state.length; i++) {
        this.set(state[i])
      }
    } else {
      this[state.key] = Utils.performance.now()
      this.counter++
    }
  }

  /**
   *
   * @param state
   * @returns {*}
   */
  has(state: Object): boolean {
    return this[state.key]
  }

  /**
   *
   * @param state
   */
  remove(state: Object): boolean {
    if (Utils.isArray(state)) {
      for (let i = 0; i < state.length; i++) {
        this.remove(state[i])
      }
    } else {
      delete this[state.key]
      this.counter++
    }
  }

  /**
   *
   * @param state
   * @returns {number}
   */
  getElapsed(state: Object): number {
    return Utils.performance.now() - this[state.key]
  }

  /**
   *
   * @returns {*}
   * @param state
   */
  getMissing(state: Array<Object>): Array<Object> {
    let missing = []
    for (let i = 0; i < state.length; i++) {
      if (!this.has(state[i])) {
        missing.push(state[i])
      }
    }

    return missing
  }

  /**
   *
   * @returns {boolean}
   * @param state
   */
  hasAny(state: Array<Object>): boolean {
    for (let i = 0; i < state.length; i++) {
      if (this.has(state[i])) {
        return true
      }
    }

    return false
  }

  /**
   *
   */
  clear() {
    for (let property in this) {
      if (this.hasOwnProperty(property)) {
        delete this[property]
      }
    }

    this.init()
  }
}
