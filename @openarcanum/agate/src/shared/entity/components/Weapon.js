// @flow

import Component from './Component'

export type Magic = {
  hitAdjustment: number,
  speedAdjustment: number,
  rangeAdjustment: number,
  minStrengthAdjustment: number,
  criticalHitChance: number,
  criticalHitEffect: number,
  criticalMissChance: number,
  criticalMissEffect: number
}


export default class Weapon extends Component {
  magic: Magic
  paperDoll: Object // art
  missile: Object // art
  visualEffect: Object // art

  bonusToHit: number
  speedFactor: number
  range: number
  minStrength: number
  ammoType: number
  ammoConsumption: number
  criticalHitChart: number
  criticalMissChart: number



  /**
   *
   */
  constructor() {
    super(...arguments)
  }

  init(params) {
    super.init(params)
  }
}
