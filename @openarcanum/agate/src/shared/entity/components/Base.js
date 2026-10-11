//@flow

import Component from './Component'
import Sector from '../../map/Sector'

import Location from '../../Location'
import Math from '../../misc/Math'
import Vec2 from '../../misc/Vec2'

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
  location: Location // tile xy
  offset: Vec2
  resistance: Resistance
  health: Health

  /**
   *
   */
  constructor() {
    super(...arguments)
    this.location = new Location()
    this.offset = new Vec2()
  }

  init(params) {
    super.init(params)
  }


}
