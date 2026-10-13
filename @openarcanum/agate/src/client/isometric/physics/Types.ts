import type Body from './Body'
import type World from './World'
import type Projector from '../Projector'
import type Camera from '../Camera'
import type Cube from '../Cube'
import type { Point2Like, Point3Like } from '../GeometryTypes'

/** Optional adapters used only by the legacy local physics/debug helpers.
 * Active multiplayer movement is driven by the authority, not this API. */
export interface PhysicsScene {
  cameras: { main: Camera }
  physics: { world: World }
  time: { physicsElapsed: number }
  input: { activePointer: { position: Point2Like } }
  iso: Projector
  sys: unknown
  add: { graphics(options: Point2Like): DebugGraphics }
}
export interface DebugGraphics {
  clear(): void; lineStyle(width: number, color: number): void
  beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void
  closePath(): void; strokePath(): void
}
export interface PhysicsSprite {
  type: 'isosprite'; exists: boolean; body: Body | null; children?: PhysicsSprite[]
  scene: PhysicsScene
  game: { camera: Camera; iso: Projector }
  rotation: number; texture: { source: { width: number; height: number }[] }
  angle: number; width: number; height: number; scaleX: number; scaleY: number
  originX: number; originY: number; isoX: number; isoY: number; isoZ: number
  isoBounds: Cube; _isoPositionChanged: boolean; fresh: boolean; outOfBoundsKill: boolean
  kill(): void
}
export interface PhysicsGroup {
  type: 'group'; exists: boolean; children: PhysicsSprite[]; length: number
  forEach(callback: (sprite: PhysicsSprite) => void, context: unknown, checkExists: boolean): void
}
export type CollisionObject = PhysicsSprite | PhysicsGroup
export type CollisionCallback = ((sprite1: PhysicsSprite, sprite2: PhysicsSprite) => unknown) | null
export interface MovingObject { body: Body }
export function isGroup(object: CollisionObject): object is PhysicsGroup { return object.type === 'group' }
export interface ColliderAdapter {
  addCollider(object1: CollisionObject, object2: CollisionObject | null, collideCallback: CollisionCallback, processCallback: CollisionCallback, context: unknown): unknown
  addOverlap(object1: CollisionObject, object2: CollisionObject | null, collideCallback: CollisionCallback, processCallback: CollisionCallback, context: unknown): unknown
}
