import type TwoVector from '../serialize/TwoVector'
import type { SpatialObject } from './SimplePhysics/HSHG'

export interface PhysicsObject extends SpatialObject {
  id: string | number
  position: TwoVector; velocity: TwoVector; friction: TwoVector
  width: number; height: number; angle: number; rotationSpeed: number; acceleration: number
  isStatic: boolean | number; isRotatingRight: boolean; isRotatingLeft: boolean; isAccelerating: boolean
  maxSpeed: number | null
  collidesWith?(other: PhysicsObject): boolean
}
export interface PhysicsGameEngine {
  world: { objects: Record<string, PhysicsObject> }
  worldSettings: { worldWrap?: boolean; width: number; height: number }
  events: {
    on(name: 'objectAdded' | 'objectDestroyed', listener: (object: PhysicsObject) => void): unknown
    emit(name: 'collisionStart' | 'collisionStop', pair: { o1: PhysicsObject; o2: PhysicsObject }): unknown
  }
}
export interface CollisionOptions { type?: 'HSHG' | 'bruteForce'; collisionDistance?: number; autoResolve?: boolean; COLLISION_DISTANCE?: number }
export interface PhysicsOptions {
  gameEngine?: PhysicsGameEngine
  dt?: number; gravity?: TwoVector; collisions?: CollisionOptions; collisionOptions?: { gameEngine?: PhysicsGameEngine }
}
export type ObjectFilter = (object: PhysicsObject) => boolean
