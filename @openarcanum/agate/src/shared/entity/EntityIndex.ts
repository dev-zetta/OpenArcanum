import type Entity from './Entity'
import KDTree from '../misc/KDTree'

export class EntityIndex {
  declare index: InstanceType<typeof KDTree>
  declare cached: Entity[]

  constructor() {
    this.index = new KDTree(64)
  }

  update(entities: Map<string, Entity>) {
    this.index.reset()

    this.cached = []
    for (let [key, value] of entities) {
      let entity = value
      this.index.addPoint([entity.base.location.x, entity.base.location.y])
      this.cached.push(entity)
    }

    this.index.sort()
  }

  getEntitiesInRadius(x: number, y: number, radius: number) {
    let indices = this.index.within(x, y, radius)

    return this._processIndices(indices)
  }

  getEntitiesInRange(minX: number, minY: number, maxX: number, maxY: number) {
    let indices = this.index.range(minX, minY, maxX, maxY)

    return this._processIndices(indices)
  }

  _processIndices(indices: number[]): Entity[] { return indices.map(index => this.cached[index]) }
}
