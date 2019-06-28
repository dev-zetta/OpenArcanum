// @flow

import Component from './Component'

export default class Armor extends Component {
  paperDoll: string // art id
  armorClassAdjustment: number
  magicArmorClassAdjustment: number
  silentMoveAdjustment: number
  magicSilentMoveAdjustment: number
  unarmedBonusDamage: number

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
