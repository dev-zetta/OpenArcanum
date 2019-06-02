/* global AGate */

import Core from './Core'
import Location from '../../Location'
import Math from '../../misc/Math'
import Flags from '../../Flags'
import Sector from '../../map/Sector'
import MovementPath from '../MovementPath'

export default class Base extends Core {
  /**
   *
   */
  constructor() {
    super(...arguments)
    this.location = [0, 0]
    this.offset = new Math.Vec2()
    this.movementPath = new MovementPath()

    //this.flags = new Flags();
  }

  /**
   *
   * @param x
   * @param y
   * @returns {boolean}
   */
  move(x, y) {
    let location = this.location

    this.offset[0] += x
    this.offset[1] += y

    let moved = false

    //let ax = Math.trunc(Math.abs(this.offset[0]));
    //if (ax >= Sector.TileHeightHalf) {
    let xr = Math.trunc(this.offset[0] / Sector.TileWidthHalf)
    if (xr != 0) {
      location[0] += xr
      this.offset[0] = this.offset[0] % Sector.TileWidthHalf
      moved = true
    }

    //}

    //let ay = Math.trunc(Math.abs(this.offset[1]));
    //if (ay >= Sector.TileHeightHalf) {
    let yr = Math.trunc(this.offset[1] / Sector.TileWidthHalf)
    if (yr != 0) {
      location[1] += yr
      this.offset[1] = this.offset[1] % Sector.TileWidthHalf
      moved = true
    }

    //}

    /* if (xr != 0 || yr != 0) {



      this.offset[0] %= Sector.TileWidthHalf;
      this.offset[1] %= Sector.TileWidthHalf;
      console.log(location, this.offset, xr, yr)

    } else {
      moved = false;
    }*/

    return moved
  }
}
