import {Sector} from './Sector';
import {Math} from './Math';
import AGate from '../agate';

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
    return (this.x / Sector.Width);
  }

  get sectorY() {
    return (this.y / Sector.Height);
  }

  get tileX() {
    return (this.x % Sector.Width);
  }

  get tileY() {
    return (this.y % Sector.Height);
  }

  static makeRaw(sectorX, sectorY, tileX, tileY) {
    return [(sectorX * Sector.Width) + tileX, (sectorY *
      Sector.Height) + tileY];
  }

}
