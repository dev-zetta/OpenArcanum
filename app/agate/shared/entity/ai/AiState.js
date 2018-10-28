/* global AGate */

export class AiState {
  constructor() {
    this.stack = []
    this.timers = []
    this.current = null
  }

  set(state) {
    this.stack[state.value] = true
    this.timers[state.value] = AGate.Utils.performance.now()
  }

  has(state) {
    return this.stack[state.value]
  }

  remove(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) this.remove(val[i])

      return
    }

    this.stack[val.value] = false
  }

  getElapsed(state) {
    return AGate.Utils.performance.now() - this.timers[state.value]
  }

  getMissing(val) {
    if (AGate.Utils.isArray(val)) {
      let missing = []
      for (let i = 0; i < val.length; i++) {
        if (!this.has(val[i])) missing.push(val[i])
      }

      return missing
    }

    return this.has(val)
  }

  hasAny(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (this.has(val[i])) return true
      }

      return false
    }

    return this.has(val)
  }
}
