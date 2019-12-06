// @flow

import Utils from '../../misc/Utils'
import type Action from './Action'

export default class State {
  counter: number
  actions: Map<string, Action>

  /**
   *
   */
  constructor(counter: number = 0) {}

  init(counter: number = 0) {
    this.counter = counter
    this.actions = new Map()
  }

  remember() {
    this._counter = this.counter
  }

  changed() {
    return this._counter !== this.counter
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
      this[state.value] = Utils.performance.now()
      this.counter++
    }
  }

  /**
   *
   * @param state
   * @returns {*}
   */
  has(state: Object): boolean {
    return this[state.value]
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
      delete this[state.value]
      this.counter++
    }
  }

  /**
   *
   * @param state
   * @returns {number}
   */
  getElapsed(state: Object): number {
    return Utils.performance.now() - this[state.value]
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
