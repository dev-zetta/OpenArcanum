import {Sector} from './Sector';
import {Math} from './Math';
import AGate from '../agate';
import Enums from './enums';

let Directions = [
  Enums.Direction.NorthWest,
  Enums.Direction.South,
  Enums.Direction.SouthWest,
  Enums.Direction.West,
  Enums.Direction.SouthEast,
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

  static calculateDistance(a, b) {
    return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  }

  static velocityToDirection(velocity) {
    let angle = Math.atan2( velocity.y, velocity.x ); //current.angleTo(next);
    let octant = Math.round( 8 * angle / ( 2 * Math.PI ) + 8 ) % 8;

    return Directions[octant];
  }



}
