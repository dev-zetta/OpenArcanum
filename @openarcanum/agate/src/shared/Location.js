//@flow

import Sector from './map/Sector'
import Math from './misc/Math'
import { Direction } from './enums/Entity'
import type { LocationRaw } from './entity/Types'
import Utils from './misc/Utils'
import Vec2 from './misc/Vec2'

let Directions = [
  Direction.SouthEast,
  Direction.South,
  Direction.SouthWest,
  Direction.West,
  Direction.NorthWest,
  Direction.North,
  Direction.NorthEast,
  Direction.East
]

export default class Location extends Vec2 {
  /**
   *
   * @param x
   * @param y
   */
  constructor(x: number | Array<number>, y: ?number) {
    super(x, y)
  }

  /**
   *
   * @returns {Location}
   */
  worldToScreen(): Location {
    let x = (this.x - this.y) * Sector.TileWidthHalf
    let y = (this.x + this.y) * Sector.TileHeightHalf

    return new Location(x, y)
  }

  /**
   *
   * @returns {*}
   */
  get sectorX(): number {
    return Math.floor(this.x / Sector.Width)
  }

  /**
   *
   * @returns {*}
   */
  get sectorY(): number {
    return Math.floor(this.y / Sector.Height)
  }

  /**
   *
   * @returns {*}
   */
  get tileX(): number {
    return Math.floor(this.x % Sector.Width)
  }

  /**
   *
   * @returns {*}
   */
  get tileY(): number {
    return Math.floor(this.y % Sector.Height)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  static transformToRaw(
    x: number | LocationRaw | Location,
    y: ?number
  ): LocationRaw {
    if (Utils.isArray(x)) {
      return x
    } else if (!Utils.isUndefined(y)) {
      return [x, y]
    } else {
      return [x.x, x.y] // Location
    }
  }

  /**
   *
   * @param sectorX
   * @param sectorY
   * @param tileX
   * @param tileY
   * @returns {*[]}
   */
  static makeRaw(
    sectorX: number,
    sectorY: number,
    tileX: number,
    tileY: number
  ): LocationRaw {
    return [sectorX * Sector.Width + tileX, sectorY * Sector.Height + tileY]
  }

  setRelative(sectorX: number, sectorY: number, tileX: number, tileY: number) {
    this.x = sectorX * Sector.Width + tileX
    this.y = sectorY * Sector.Height + tileY
  }

  /**
   *
   * @param sectorX
   * @param sectorY
   * @param tileX
   * @param tileY
   * @returns {*[]}
   */
  static make(
    sectorX: number,
    sectorY: number,
    tileX: number,
    tileY: number
  ): LocationRaw {
    return new Location(
      sectorX * Sector.Width + tileX,
      sectorY * Sector.Height + tileY
    )
  }

  /**
   *
   * @param location
   * @returns {Vec2|*}
   */
  getVelocity(location: Location | Array<number>): Vec2 {
    if (Utils.isArray(location)) {
      location = new Location(location)
    }

    let velocity = location.subtract(this, true)
    velocity.normalize()

    return velocity
  }

  /**
   *
   * @param location
   * @returns {*}
   */
  getDistance(location: Location): number {
    return Math.max(
      Math.abs(this.x - location.x),
      Math.abs(this.y - location.y)
    )
  }

  /**
   *
   * @param location
   * @returns {*}
   */
  static calculateLength(location: Array<number>): number {
    return Math.sqrt(location[0] * location[0] + location[1] * location[1])
  }

  /**
   *
   * @param location
   * @returns {number[]}
   */
  static calculateNormalize(location: Array<number>): Array<number> {
    let length = Location.calculateLength(location)

    // Collect a ratio to shrink the x and y coords
    let invertedLength = length < Number.MIN_VALUE ? 0 : 1 / length

    return [location[0] * invertedLength, location[1] * invertedLength]
  }

  /**
   *
   * @param a
   * @param b
   * @returns {Array<number>}
   */
  static calculateVelocity(a: Array<number>, b: Array<number>): Array<number> {
    let velocity = [b[0] - a[0], b[1] - a[1]]
    return Location.calculateNormalize(velocity)
  }

  /**
   *
   * @param a
   * @param b
   * @returns {*}
   */
  static calculateDistance(a: Array<number>, b: Array<number>): number {
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
  }

  /**
   *
   * @param location
   * @param x
   * @param y
   * @returns {number[]}
   */
  static calculateMultiply(
    location: Array<number>,
    x: number,
    y: ?number = null
  ): Array<number> {
    if (y == null) {
      y = x
    }

    return [location[0] * x, location[1] * y]
  }

  /**
   *
   * @param velocity
   * @returns {*}
   */
  static velocityToDirection(velocity: Array<number>): string {
    let angle = Math.atan2(velocity[1], velocity[0]) //current.angleTo(next);
    let octant = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8

    return Directions[octant]
  }

  getEntityDepth(): number {
    return 10000 - (this.y * 64 + this.x)
  }
}
