// @flow

export default class State {
  counter: number

  /**
   *
   */
  constructor(counter: number = 0) {
    this.counter = counter
  }

  remember() {
    this._counter = this.counter
  }

  changed() {
    return this._counter != this.counter
  }

  /**
   *
   * @param state
   */
  set(state: Object) {
    if (AGate.Utils.isArray(state)) {
      for (let i = 0; i < state.length; i++) {
        this.set(state[i])
      }
    } else {
      this[state.value] = AGate.Utils.performance.now()
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
    if (AGate.Utils.isArray(state)) {
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
    return AGate.Utils.performance.now() - this[state.value]
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
}
