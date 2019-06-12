//@flow

import Component from './Component'
import Math from '../../misc/Math'

import Sector from '../../map/Sector'

import type {LocationRaw, Flags} from '../Types'

export type Resistance = {
  damage: number,
  fire: number,
  electrical: number,
  poison: number,
  magic: number
}

export type Health = {
  points: number,
  adjustment: number,
  damage: number
}

export default class Base extends Component {
  type: string
  prototype: number
  nameIndex: number
  descIndex: number
  armorClass: number
  material: number
  soundEffect: number
  category: string
  location: LocationRaw // tile xy
  offset: LocationRaw
  resistance: Resistance
  health: Health
  flags: Flags



  /**
   *
   */
  constructor() {
    super(...arguments)
    this.location = [0, 0]
    this.offset = [0, 0]


    //this.flags = new Flags();
  }

  /**
   * Move using pixel values
   * @param x pixels
   * @param y pixels
   * @returns {boolean}
   */
  move(x: number, y: number): boolean {
    let location = this.location

    this.offset[0] += x
    this.offset[1] += y

    let moved = false

    //let ax = Math.trunc(Math.abs(this.offset[0]));
    //if (ax >= Sector.TileHeightHalf) {
    let xr = Math.trunc(this.offset[0] / Sector.TileWidthHalf)
    if (xr !== 0) {
      location[0] += xr
      this.offset[0] = this.offset[0] % Sector.TileWidthHalf
      moved = true
    }

    //}

    //let ay = Math.trunc(Math.abs(this.offset[1]));
    //if (ay >= Sector.TileHeightHalf) {
    let yr = Math.trunc(this.offset[1] / Sector.TileWidthHalf)
    if (yr !== 0) {
      location[1] += yr
      this.offset[1] = this.offset[1] % Sector.TileWidthHalf
      moved = true
    }

    //}

    //console.log(location, this.offset, xr, yr)

    return moved
  }
}
