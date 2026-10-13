
export type Magic = { hitAdjustment: number; speedAdjustment: number; rangeAdjustment: number; minStrengthAdjustment: number; criticalHitChance: number; criticalHitEffect: number; criticalMissChance: number; criticalMissEffect: number }
import Component from './Component'

export default class Weapon extends Component {
  declare magic: Magic
  declare paperDoll: Record<string, unknown>
  declare missile: Record<string, unknown>
  declare visualEffect: Record<string, unknown>
  declare bonusToHit: number
  declare speedFactor: number
  declare range: number
  declare minStrength: number
  declare ammoType: number
  declare ammoConsumption: number
  declare criticalHitChart: number
  declare criticalMissChart: number


                    // art
                  // art
                       // art

  /**
   *
   */
  constructor() {
    super()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  }
}
