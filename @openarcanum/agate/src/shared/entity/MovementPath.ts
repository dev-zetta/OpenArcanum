import type Entity from './Entity'

import Sector from '../map/Sector'
import Math from '../misc/Math'
import Location from '../Location'

export interface PathPoint { x: number; y: number }
export type MovingEntity = Entity

export default class MovementPath {
  waypoints: PathPoint[] = []
  currentIndex = 0
  waypointElapsed = 0
  movedDistance = 0
  nextTo = false
  // start() establishes velocity before the movement loop begins.
  declare velocity: PathPoint
  directionName: string | null = null

  get currentWaypoint(): PathPoint | undefined { return this.waypoints[this.currentIndex] }
  get nextWaypoint(): PathPoint | undefined { return this.waypoints[this.currentIndex + 1] }
  get lastWaypoint(): PathPoint | undefined { return this.waypoints[this.waypoints.length - 1] }

  valid(): boolean { return this.waypoints.length > 0 }

  clear(): void {
    this.waypoints.length = 0
    this.currentIndex = 0
    this.movedDistance = 0
  }

  addPoints(list: readonly PathPoint[]): void {
    for (const waypoint of list) this.waypoints.push(waypoint)
  }

  isTargetSame(location: { equals(other: PathPoint): boolean }): boolean {
    // Existing callers ask this only for a populated movement path.
    return location.equals(this.lastWaypoint!)
  }

  directionTo(_entity: MovingEntity): void {}

  start(nextTo: boolean): false | void {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      lll('movement finished', this.waypoints)
      return false
    }
    this.nextTo = nextTo
    const current = this.currentWaypoint!
    const next = this.nextWaypoint!
    this.velocity = Location.calculateVelocity(current, next)
    this.directionName = String(Location.velocityToDirection(this.velocity))
  }

  process(entity: MovingEntity, elapsed: number): boolean {
    if (this.currentIndex + 1 >= this.waypoints.length) return false
    if (this.nextTo && this.currentIndex + 2 === this.waypoints.length) {
      this.currentIndex++
      return false
    }
    if (!entity.critter) throw new Error('Movement requires a critter component')
    const speed = entity.critter.getMovementSpeed()
    const delta = Location.calculateMultiply(this.velocity, (speed * Sector.TileWidthHalf * elapsed) / 1000.0)
    this.processMovement(entity, delta[0], delta[1])
    return true
  }

  processMovement(entity: MovingEntity, dx: number, dy: number): boolean {
    const moved = this.move(entity, dx, dy)
    if (moved) {
      const { location } = entity.base
      const nextWaypoint = this.nextWaypoint!
      if (location.equals(nextWaypoint)) {
        entity.world.moveEntity(entity, this.currentWaypoint!, nextWaypoint)
        this.movedDistance++
        this.currentIndex++
        this.start(this.nextTo)
      }
    }
    return moved
  }

  /** Move using pixel values. */
  move(entity: MovingEntity, x: number, y: number): boolean {
    const { base } = entity
    base.offset.x += x
    base.offset.y += y
    let moved = false
    const distancePerTile = 40.0
    if (Math.abs(base.offset.x) >= distancePerTile) {
      const remainder = base.offset.x % distancePerTile
      base.location.x += Math.trunc((base.offset.x - remainder) / distancePerTile)
      base.offset.x = remainder
      moved = true
    }
    if (Math.abs(base.offset.y) >= distancePerTile) {
      const remainder = base.offset.y % distancePerTile
      base.location.y += Math.trunc((base.offset.y - remainder) / distancePerTile)
      base.offset.y = remainder
      moved = true
    }
    return moved
  }
}
