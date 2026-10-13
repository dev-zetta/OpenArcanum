import workerpool from 'workerpool'
export default class WorkerPool {
  declare pool: ReturnType<typeof workerpool.pool>
  constructor() { this.pool = workerpool.pool() }
  exec<Args extends unknown[], Result>(func: string | ((...args: Args) => Result), params?: Args) {
    return this.pool.exec(func, params)
  }
}
