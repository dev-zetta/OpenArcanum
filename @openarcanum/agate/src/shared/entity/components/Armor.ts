import Component from './Component'

export default class Armor extends Component {
  declare paperDoll: string
  declare armorClassAdjustment: number
  declare magicArmorClassAdjustment: number
  declare silentMoveAdjustment: number
  declare magicSilentMoveAdjustment: number
  declare unarmedBonusDamage: number

                    // art id

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
