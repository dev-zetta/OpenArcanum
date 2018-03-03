/* global AGate */

let workerpool = AGate.requireNode('workerpool');

// https://github.com/josdejong/workerpool
export class WorkerPool {
  constructor(engine) {
    this.engibe = engine;
    this.pool = workerpool.pool();
  }

  exec(func, params) {
    return this.pool.exec(func, params);
  }


}
