import Location from '../../shared/Location'

const error = (code, message) => ({ code, message })
const position = entity => [entity.base.location.x, entity.base.location.y]
const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1

/** Approach is public movement; ownership changes require a separate private
 * pickup ACK at the current revision. No inventory contents ride snapshots. */
export default class GroundInteractions {
  constructor(map, ownership) { this.map = map; this.ownership = ownership }

  prepare(targetId, actor) {
    const target = this.ownership.groundTarget(targetId)
    if (target.code) return target
    const entity = target.record.entity, location = position(entity), origin = position(actor)
    let path
    if (near(origin, location)) path = [origin]
    else {
      for (const candidate of [[location[0] - 1, location[1]], [location[0], location[1] - 1],
        [location[0], location[1] + 1], [location[0] + 1, location[1]]]) {
        const route = this.map.pathFind.findPath(actor.base.location, new Location(candidate)).map(point => [point.x, point.y])
        if (route.length && (!path || route.length < path.length)) path = route
      }
    }
    if (!path) return error('NO_PATH', 'No walkable path reaches a cardinal neighbor of the ground item')
    return { path, pending: { targetId, entity, location } }
  }

  apply(pending, actor) {
    const target = this.ownership.groundTarget(pending.targetId)
    if (target.code || target.record.entity !== pending.entity ||
        position(target.record.entity).some((value, index) => value !== pending.location[index])) {
      return error('TARGET_CHANGED', 'Ground item changed or disappeared during the approach')
    }
    if (!near(position(actor), pending.location)) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the ground item')
    return { result: { kind: 'ground', targetId: pending.targetId } }
  }
}
