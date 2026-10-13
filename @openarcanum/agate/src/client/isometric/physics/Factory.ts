import type World from './World'
import type { PhysicsScene, CollisionObject, CollisionCallback } from './Types'

/** Legacy factory requires an explicit collider scheduler adapter. */
export default class Factory {
  world: World
  scene: PhysicsScene
  sys: unknown
  constructor(world: World) { this.world = world; this.scene = world.scene; this.sys = this.scene.sys }
  collider(object1: CollisionObject, object2: CollisionObject | null = null, collideCallback: CollisionCallback = null, processCallback: CollisionCallback = null, context?: unknown): unknown {
    const adapter = this.world.colliderAdapter
    if (!adapter) throw new Error('The legacy physics factory requires a collider scheduler adapter.')
    return adapter.addCollider(object1, object2, collideCallback, processCallback, context)
  }
  overlap(object1: CollisionObject, object2: CollisionObject | null = null, collideCallback: CollisionCallback = null, processCallback: CollisionCallback = null, context?: unknown): unknown {
    const adapter = this.world.colliderAdapter
    if (!adapter) throw new Error('The legacy physics factory requires a collider scheduler adapter.')
    return adapter.addOverlap(object1, object2, collideCallback, processCallback, context)
  }
}
