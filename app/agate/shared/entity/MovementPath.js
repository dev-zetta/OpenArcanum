/* global AGate */

import { Waypoint } from './Waypoint'
import { Sector } from '../map/Sector'
import { Math } from '../misc/Math'
import { Location } from '../Location'

export class MovementPath {
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
  addPoints(list) {
    for (let i = 0; i < list.length; i++) {
      let waypoint = list[i]

      this.waypoints.push(waypoint)
    }
  }

  /**
   *
   * @returns {boolean}
   */
  start(nextTo) {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      console.log(this.waypoints)
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
  process(entity, elapsed) {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      entity.moved = false
      // console.log(this.currentIndex, this.waypoints.length)
      this.processVisual(entity, null, null)
      return false
    }

    let speed = entity.npc.getMovementSpeed()
    let delta = Location.calculateMultiply(
      this.velocity,
      speed * Sector.TileWidthHalf * (elapsed / 1000)
    )

    this.processMovement(entity, delta[0], delta[1])
    this.processVisual(entity, delta[0], delta[1])
    return true
  }

  processMovement(entity, dx, dy) {
    entity.moved = entity.base.move(dx, dy)

    //let timeAtTile = 1000 / speed;
    if (entity.moved /*this.waypointElapsed >= timeAtTile*/) {
      //this.waypointElapsed = this.waypointElapsed % timeAtTile;
      this.movedDistance++
      this.currentIndex++
      this.start(this.nextTo)
    }
  }

  processVisual(entity, dx, dy) {
    let visualClass = entity.getCurrentVisual()
    if (!visualClass) return false

    let sprite = visualClass.sprite
    if (!sprite || !sprite.isValid()) return false

    sprite.setStage(this.directionName)

    if (dx != null && dy != null) sprite.move(dx, dy)

    return true
  }
}
