// @flow

import Component from './Component'
import Flags from '../../Flags';


export default class Weapon extends Component {
  fateFlags: Flags
  background: number
  backgroundText: number
  partyId: number
  fogMask: number
  playerName: string
  bankMoney: string




  /**
   *
   */
  constructor() {
    super(...arguments)

    this.fateFlags = new Flags()

  }

  init(params) {
    super.init(params)
  }
}
