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

  get currentWaypoint() {
    return this.waypoints[this.currentIndex]
  }

  get nextWaypoint() {
    return this.waypoints[this.currentIndex + 1]
  }

  get lastWaypoint() {
    return this.waypoints[this.waypoints.length - 1]
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

  isTargetSame(location) {
    return location.equals(this.lastWaypoint)
  }

  /**
   *
   * @returns {boolean}
   */
  start(nextTo: boolean) {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      lll(`movement finished`, this.waypoints)
      return false
    }

    this.nextTo = nextTo
    let current = this.waypoints[this.currentIndex]
    let next = this.waypoints[this.currentIndex + 1]

    this.velocity = Location.calculateVelocity(current, next)

    let direction = Location.velocityToDirection(this.velocity)
    this.directionName = String(direction)

    /* lll(
      `movement started`,
      this.currentIndex,
      this.directionName,
      current,
      next,
      this.velocity
    )*/
  }

  /**
   *
   * @param entity
   * @param elapsed
   * @returns {boolean}
   */
  process(entity: Entity, elapsed: number): boolean {
    if (this.currentIndex + 1 >= this.waypoints.length) {
      //if (entity.moved) {
      //
      this.processVisual(entity, null, null)
      //}

      return false
    }

    if (this.nextTo && this.currentIndex + 2 === this.waypoints.length) {
      this.currentIndex++
      this.processVisual(entity, null, null)
      lll(
        `movement finished`,
        this.currentIndex,
        this.waypoints.length,
        this.waypoints
      )
      return false
    }

    let speed = entity.critter.getMovementSpeed()
    let delta = Location.calculateMultiply(
      this.velocity,
      (speed * Sector.TileWidthHalf * elapsed) / 1000.0
    )

    //lll(elapsed, delta, this.velocity)

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
    let moved = this.move(entity, dx, dy)

    //let timeAtTile = 1000 / speed;
    if (moved /*this.waypointElapsed >= timeAtTile*/) {
      //this.waypointElapsed = this.waypointElapsed % timeAtTile;
      //lll(`moved`,entity.base.location, this.currentWaypoint, this.nextWaypoint)
      const { location } = entity.base
      const nextWaypoint = this.nextWaypoint

      if (location.equals(nextWaypoint)) {
        // we entered to destination waypoint
        const currentWaypoint = this.currentWaypoint

        entity.onTileEnter(currentWaypoint, nextWaypoint)

        this.movedDistance++
        this.currentIndex++
        this.start(this.nextTo)
      }
    }

    return moved
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
      lll(`visual not found`, entity)
      return false
    }

    let sprite = visualClass.sprite
    if (!sprite || !sprite.isValid()) {
      //lll('sprite not found', entity)
      return false
    }

    sprite.setStage(this.directionName)

    if (dx !== null && dy !== null) {
      //lll('sprite move', dx, dy)
      const { location, offset } = entity.base
      //lll('aaa', sprite.iso.isoPosition, dx, dy, offset)
      sprite.setPosition(location.x * 40 + offset.x, location.y * 40 + offset.y)
      //lll('aab', sprite.iso.isoPosition)
    }

    return true
  }

  /**
   * Move using pixel values
   * @param entity
   * @param x pixels
   * @param y pixels
   * @returns {boolean}
   */
  move(entity: Entity, x: number, y: number): boolean {
    let { base } = entity
    base.offset.x += x
    base.offset.y += y

    let moved = false

    //let ax = Math.trunc(Math.abs(this.offset[0]));
    //if (ax >= Sector.TileHeightHalf) {
    const dm = 40.0

    if (Math.abs(base.offset.x) >= dm) {
      const xr = base.offset.x % dm
      base.location.x += Math.trunc((base.offset.x - xr) / dm)
      base.offset.x = xr
      moved = true
    }

    //}

    //let ay = Math.trunc(Math.abs(this.offset[1]));
    //if (ay >= Sector.TileHeightHalf) {
    let dm2 = 40.0
    if (Math.abs(base.offset.y) >= dm2) {
      const yr = base.offset.y % dm2

      base.location.y += Math.trunc((base.offset.y - yr) / dm2)
      base.offset.y = yr
      moved = true
    }

    //}

    //console.log(location, this.offset, xr, yr)

    return moved
  }
}
