import { Sector } from './Sector';

export class Location {

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  worldToScreen() {
    let x = ((this.x - this.y) * (Sector.TileWidth / 2));
    let y = ((this.x + this.y) * (Sector.TileHeight / 2));

    return new Location(x, y);
  }

  getSectorX() {
    return (this.x / Sector.Width);
  }

  getSectorY() {
    return (this.y / Sector.Height);
  }

  getTileX() {
    return (this.x % Sector.Width);
  }

  getTileY() {
    return (this.y % Sector.Height);
  }

}
