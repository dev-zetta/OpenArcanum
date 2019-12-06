/**
 * Minimize garbage collector thrashing by re-using existing objects instead of
 * creating new ones. Requires manually lifecycle management.
 * @constructor
 * @param {Function} T
 */
export default class ObjectPool {
  constructor(T, ...constructParams) {
    this.constructParams = constructParams
    this.freeList = []
    this.count = 0
    this.T = T

    this.expand(100)
  }

  /**
   * Get a pooled object
   */
  aquire(initParams) {
    // Grow the list by 20%ish if we're out
    if (this.freeList.length <= 0) {
      this.expand(Math.round(this.count * 0.2) + 1)
    }

    const item = this.freeList.pop()

    item.init(initParams)
    return item
  }

  /**
   * Return an object back to the pool.
   */
  release(item) {
    this.freeList.push(item)
  }

  /**
   * @param {Number} Amount of new objects to allocate for this pool.
   */
  expand(count) {
    for (let n = 0; n < count; n++) {
      this.freeList.push(new this.T(...this.constructParams))
    }
    this.count += count
  }

  /**
   * @return {Number} Total amount of allocated objects (available and in-use).
   */
  totalSize() {
    return this.count
  }

  /**
   * @return {Number} Total number of objects currently available.
   */
  totalFree() {
    return this.freeList.length
  }

  /**
   * @return {Number} Total number of objects currently in-use.
   */
  totalUsed() {
    return this.count - this.freeList.length
  }
}
