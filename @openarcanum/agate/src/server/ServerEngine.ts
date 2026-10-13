import type Entity from '../shared/entity/Entity'
import type GameWorld from './World'
import ServerNetwork from './ServerNetwork'
/** Public compatibility name for the unfinished, opt-in legacy network path. */
export default class ServerEngine extends ServerNetwork {
  addDynamicEntityToWorld(entity: Entity, world: GameWorld): Entity | null {
    if (Number(entity.id) >= this.options.clientIDSpace && this.findLocalShadow(entity)) return null
    entity.onAddToWorld(world)
    this.events.emit('objectAdded', entity)
    return entity
  }
  removeDynamicEntityFromWorld(value: Entity | string, world: GameWorld): void {
    const id = typeof value === 'string' ? value : value.id
    const entity = world.getDynamicEntity(id)
    if (!entity) throw new Error(`Game attempted to remove an absent legacy entity: ${id}`)
    this.events.emit('objectDestroyed', entity)
    entity.onRemoveFromWorld(world)
    world.entityManager.removeEntity(entity)
  }
}
