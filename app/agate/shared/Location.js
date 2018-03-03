/* global AGate */

import {Sector} from './map/Sector';
import {Math} from './misc/Math';
import Enums from './enums';

let Directions = [
  Enums.Direction.SouthEast,
  Enums.Direction.South,
  Enums.Direction.SouthWest,
  Enums.Direction.West,
  Enums.Direction.NorthWest,
  Enums.Direction.North,
  Enums.Direction.NorthEast,
  Enums.Direction.East
];


export class Location extends Math.Vec2 {

  constructor(x, y) {
    if (AGate.Utils.isArray(x)) {
      super(x[0], x[1]);
    } else {
      super(x, y);
    }

  }

  worldToScreen() {
    let x = ((this.x - this.y) * Sector.TileWidthHalf);
    let y = ((this.x + this.y) * Sector.TileHeightHalf);

    return new Location(x, y);
  }

  get sectorX() {
    return Math.floor(this.x / Sector.Width);
  }

  get sectorY() {
    return Math.floor(this.y / Sector.Height);
  }

  get tileX() {
    return Math.floor(this.x % Sector.Width);
  }

  get tileY() {
    return Math.floor(this.y % Sector.Height);
  }

  static makeRaw(sectorX, sectorY, tileX, tileY) {
    return [(sectorX * Sector.Width) + tileX, (sectorY *
      Sector.Height) + tileY];
  }

  getVelocity(location) {
    if (AGate.Utils.isArray(location))
      location = new Location(location);

    let velocity = location.subtract(this, true);
    velocity.normalize();

    return velocity;
  }

  getDistance(location) {
    return Math.max(Math.abs(this.x - location.x), Math.abs(this.y - location.y));
  }

  static calculateLength(location) {
    return Math.sqrt(location[0] * location[0] + location[1] * location[1]);
  }

  static calculateNormalize(location) {
    let length = Location.calculateLength(location);

    // Collect a ratio to shrink the x and y coords
    var invertedLength = (length < Number.MIN_VALUE) ? 0 : 1 / length;

    return [location[0] * invertedLength, location[1] * invertedLength];
  }

  static calculateVelocity(a, b) {
    let velocity = [b[0] - a[0], b[1] - a[1]];
    return Location.calculateNormalize(velocity);
  }

  static calculateDistance(a, b) {
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  }

  static calculateMultiply(location, x, y = null) {
    if (y == null)
      y = x;

    return [location[0] * x, location[1] * y];
  }

  static velocityToDirection(velocity) {
    let angle = Math.atan2( velocity[1], velocity[0] ); //current.angleTo(next);
    let octant = Math.round( 8 * angle / ( 2 * Math.PI ) + 8 ) % 8;

    return Directions[octant];
  }



}
