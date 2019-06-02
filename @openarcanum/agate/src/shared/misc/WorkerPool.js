/* global AGate */

let workerpool = require(`workerpool`)

// https://github.com/josdejong/workerpool
export default class WorkerPool {
  constructor() {
    this.pool = workerpool.pool()
  }

  exec(func, params) {
    return this.pool.exec(func, params)
  }
}
