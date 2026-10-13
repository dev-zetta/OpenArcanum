import { failure as error, position, samePosition as same, near, type AuthorityEntity, type AuthorityMap, type DoorEntity, type ContainerEntity, type Position, type PendingUse, type PreparedUse, type UseResult, type Outcome, type Failure } from './AuthorityTypes'
import type InventoryOwnership from './InventoryOwnership'
import Location from '../../shared/Location'


/** Approach is public movement; ownership changes require a separate private
 * pickup ACK at the current revision. No inventory contents ride snapshots. */
export default class GroundInteractions {
  declare map: AuthorityMap
  declare ownership: InventoryOwnership
  constructor(map: AuthorityMap, ownership: InventoryOwnership) { this.map = map; this.ownership = ownership }

  prepare(targetId: string, actor: AuthorityEntity): Outcome<PreparedUse> {
    const target = this.ownership.groundTarget(targetId)
    if (target.code !== undefined) return target
    const entity = target.record.entity, location = position(entity), origin = position(actor)
    let path: Position[] | undefined
    if (near(origin, location)) path = [origin]
    else {
      for (const candidate of [[location[0] - 1, location[1]], [location[0], location[1] - 1],
        [location[0], location[1] + 1], [location[0] + 1, location[1]]]) {
        const route = this.map.pathFind.findPath(actor.base.location, new Location(candidate as Position)).map((point): Position => [point.x, point.y])
        if (route.length && (!path || route.length < path.length)) path = route
      }
    }
    if (!path) return error('NO_PATH', 'No walkable path reaches a cardinal neighbor of the ground item')
    return { path, pending: { targetId, entity, location } }
  }

  apply(pending: PendingUse, actor: AuthorityEntity): Outcome<UseResult> {
    const target = this.ownership.groundTarget(pending.targetId)
    if (target.code !== undefined || target.record.entity !== pending.entity ||
        position(target.record.entity).some((value, index) => value !== pending.location[index])) {
      return error('TARGET_CHANGED', 'Ground item changed or disappeared during the approach')
    }
    if (!near(position(actor), pending.location)) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the ground item')
    return { result: { kind: 'ground', targetId: pending.targetId } }
  }
}
