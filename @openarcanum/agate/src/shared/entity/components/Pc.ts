import Component from './Component'
import Flags from '../../Flags'

export default class Weapon extends Component {
  declare fateFlags: Flags
  declare background: number
  declare backgroundText: number
  declare partyId: number
  declare fogMask: number
  declare playerName: string
  declare bankMoney: string


  /**
   *
   */
  constructor() {
    super()

    this.fateFlags = new Flags()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  }
}
