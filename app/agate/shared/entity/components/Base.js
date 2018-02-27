import {Location} from '../../Location';
import {Math} from '../../Math';
import {Flags} from '../../Flags';
import {Sector} from '../../Sector';
import {MovementPath} from '../MovementPath';

export default class {
  constructor() {
    this.location = [0, 0];
    this.offset = new Math.Vec2();
    this.movementPath = new MovementPath();

    //this.flags = new Flags();
  }

  move(x, y) {
    let location = this.location;
    //console.log(this.offset);
    this.offset[0] += x;
    this.offset[1] += y;

    let xr = Math.round(this.offset[0] / Sector.TileWidthHalf);
    let yr = Math.round(this.offset[1] / Sector.TileWidthHalf);

    let moved;
    if (xr != 0 || yr != 0) {
      location[0] += xr;
      location[1] += yr;

      this.offset[0] %= Sector.TileWidthHalf;
      this.offset[1] %= Sector.TileWidthHalf;
      moved = true;
    } else {
      moved = false;
    }

    return moved;
  }

}

