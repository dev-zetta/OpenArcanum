
export type Resistance = { damage: number; fire: number; electrical: number; poison: number; magic: number }
export type Health = { points: number; adjustment: number; damage: number }
import Component from './Component'
import Sector from '../../map/Sector'

import Location from '../../Location'
import Math from '../../misc/Math'
import Vec2 from '../../misc/Vec2'

export default class Base extends Component {
  declare type: string
  declare prototype: number
  declare nameIndex: number
  declare descIndex: number
  declare armorClass: number
  declare material: number
  declare soundEffect: number
  declare category: string
  declare location: Location
  declare offset: Vec2
  declare resistance: Resistance
  declare health: Health


                     // tile xy

  /**
   *
   */
  constructor() {
    super()
    this.location = new Location()
    this.offset = new Vec2()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  }

}
