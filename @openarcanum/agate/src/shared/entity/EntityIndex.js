/* global AGate */
import KDTree from '../misc/KDTree'

// https://www.npmjs.com/package/kdgrass
const kdgrass = require(`kdgrass`)

export class EntityIndex {
  constructor() {
    this.index = new KDTree(64)
  }

  update(entities) {
    this.index.reset()

    this.cached = []
    for (let [key, value] of entities) {
      let entity = value
      this.index.addPoint(entity.base.location)
      this.cached.push(entity)
    }

    this.index.sort()
  }

  getEntitiesInRadius(x, y, radius) {
    let indices = this.index.within(x, y, radius)

    return this._processIndices(indices)
  }

  getEntitiesInRange(minX, minY, maxX, maxY) {
    let indices = this.index.range(minX, minY, maxX, maxY)

    return this._processIndices(indices)
  }

  _processIndices(indices) {
    for (let i = 0; i < indices.lentth; i++) {
      let index = indices[i]
      let entity = this.cached[index]
      indices[i] = entity
    }

    return indices
  }
}
