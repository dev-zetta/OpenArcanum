// @flow

import Component from './Component'

export default class Projectile extends Component {
  flagsCombat: number // int 32
  flagsCombatDamage: number
  hitLoc: number

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

