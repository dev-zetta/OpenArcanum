import Component from './Component'

export default class Projectile extends Component {
  declare flagsCombat: number
  declare flagsCombatDamage: number
  declare hitLoc: number

                      // int 32

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
