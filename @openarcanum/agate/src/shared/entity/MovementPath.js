// @flow

import Waypoint from './Waypoint'
import Sector from '../map/Sector'
import Math from '../misc/Math'
import Location from '../Location'
import type Entity from './Entity'

export default class MovementPath {
  waypoints: Array<Waypoint>
  currentIndex: number
  waypointElapsed: number
  movedDistance: number
  nextTo: boolean

  velocity: Array<number>
  directionName: string

  /**
   *
   */
  constructor() {
    this.waypoints = []
    this.currentIndex = 0
    //this.totalElapsed = 0;
    this.waypointElapsed = 0
    this.movedDistance = 0
    this.nextTo = false
  }

  /**
   *
   */
  clear() {
    this.waypoints.length = 0
    this.currentIndex = 0
    this.movedDistance = 0
  }

  /**
   *
   * @param list
   */
  addPoints(list: Array<Waypoint>) {
    for (let i = 0; i < list.length; i++) {
      let waypoint = list[i]

      this.waypoints.push(waypoint)
    }
  }

  /**
   *
   * @returns {boolean}
   */
  start(nextTo: boolean) {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      //lll(`movement finished`, this.waypoints)
      return false
    }

    this.nextTo = nextTo

    let current = this.waypoints[this.currentIndex]
    let next = this.waypoints[this.currentIndex + 1]

    this.velocity = Location.calculateVelocity(current, next)

    let direction = Location.velocityToDirection(this.velocity)
    this.directionName = String(direction)

    //let vec = current.lerp(next, percent, true);
  }

  /**
   *
   * @param entity
   * @param elapsed
   * @returns {boolean}
   */
  process(entity: Entity, elapsed: number): boolean {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      entity.moved = false
      //lll(`movement finished`, this.currentIndex, this.waypoints.length)
      this.processVisual(entity, null, null)
      return false
    }

    let speed = entity.critter.getMovementSpeed()
    let delta = Location.calculateMultiply(
      this.velocity,
      speed * Sector.TileWidthHalf * (elapsed / 1000)
    )

    this.processMovement(entity, delta[0], delta[1])
    this.processVisual(entity, delta[0], delta[1])
    return true
  }

  /**
   *
   * @param entity
   * @param dx
   * @param dy
   */
  processMovement(entity: Entity, dx: number, dy: number) {
    entity.moved = entity.base.move(dx, dy)

    //let timeAtTile = 1000 / speed;
    if (entity.moved /*this.waypointElapsed >= timeAtTile*/) {
      //this.waypointElapsed = this.waypointElapsed % timeAtTile;
      this.movedDistance++
      this.currentIndex++
      this.start(this.nextTo)
    }
  }

  /**
   *
   * @param entity
   * @param dx
   * @param dy
   * @returns {boolean}
   */
  processVisual(entity: Entity, dx: ?number, dy: ?number) {
    let visualClass = entity.visual.getCurrent()
    if (!visualClass) {
      return false
    }

    let sprite = visualClass.sprite
    if (!sprite || !sprite.isValid()) {
      return false
    }

    sprite.setStage(this.directionName)

    if (dx != null && dy != null) {
      //lll('sprite move', dx, dy)
      sprite.move(dx, dy)
    }

    return true
  }
}
