/*global window */

let perf = null

// use global browser performance module
// for node create a polyfill

if (window && window.performance) {
  perf = window.performance
} else {
  perf = {
    start: Date.now(),
    now() {
      return Date.now() - this.start
    }
  }
}

export default perf
