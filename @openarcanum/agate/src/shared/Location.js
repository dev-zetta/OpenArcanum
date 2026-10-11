//@flow

import Sector from './map/Sector'
import Math from './misc/Math'
import { Direction } from './entity/Enums'
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

  equals(other: Location) {
    return this.x === other.x && this.y === other.y
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
  static calculateLengthRaw(x, y): number {
    return Math.sqrt(x * x + y * y)
  }


  /**
   *
   * @param location
   * @returns {*}
   */
  static calculateLength(location: Location): number {
    return Math.sqrt(location.x * location.x + location.y * location.y)
  }

  /**
   *
   * @param location
   * @returns {number[]}
   */
  static calculateNormalizeRaw(x, y): Array<number> {
    let length = Location.calculateLengthRaw(x, y)

    // Collect a ratio to shrink the x and y coords
    let invertedLength = length < Number.MIN_VALUE ? 0 : 1 / length

    return [x * invertedLength, y * invertedLength]
  }


  /**
   *
   * @param location
   * @returns {number[]}
   */
  static calculateNormalize(location: Location): Location {
    let length = Location.calculateLength(location)

    // Collect a ratio to shrink the x and y coords
    let invertedLength = length < Number.MIN_VALUE ? 0 : 1 / length

    return new Location(location.x * invertedLength, location.y * invertedLength)
  }


  /**
   *
   * @param a
   * @param b
   * @returns {Array<number>}
   */
  static calculateVelocityRaw(a: Array<number>, b: Array<number>): Array<number> {
    return Location.calculateNormalizeRaw(b[0] - a[0], b[1] - a[1])
  }

  /**
   *
   * @param a
   * @param b
   * @returns {Array<number>}
   */
  static calculateVelocity(a: Location, b: Location): Location {
    return new Location(b.x - a.x, b.y - a.y) //new Location(Location.calculateNormalizeRaw(b.x - a.x, b.y - a.y))
  }

  /**
   *
   * @param a
   * @param b
   * @returns {*}
   */
  static calculateDistanceRaw(a: Array<number>, b: Array<number>): number {
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))
  }

  static calculateDistance(a: Location, b: Location): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  }

  distanceTo(b: Location): number {
    return Math.max(Math.abs(this.x - b.x), Math.abs(this.y - b.y))
  }

  /**
   *
   * @param location
   * @param x
   * @param y
   * @returns {number[]}
   */
  static calculateMultiplyRaw(
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
   * @param location
   * @param x
   * @param y
   * @returns {number[]}
   */
  static calculateMultiply(
    location: Location,
    x: number,
    y: ?number = null
  ): Array<number> {
    if (y == null) {
      y = x
    }

    return [location.x * x, location.y * y]
  }

  /**
   *
   * @param velocity
   * @returns {*}
   */
  static velocityToDirection(velocity: Location): string {
    let angle = Math.atan2(velocity.y, velocity.x) //current.angleTo(next);
    let octant = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8
    let direction = Directions[octant]
    if (!direction) {
      debugger
    }
    return direction
  }

  getEntityDepth(): number {
    return 10000 - (this.y * 64 + this.x)
  }
}
