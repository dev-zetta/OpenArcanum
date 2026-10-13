import Component from './Component'
import Flags from '../../Flags'

export default class Container extends Component {
  declare flags: InstanceType<typeof Flags>

  declare lockDifficulty: number
  declare keyId: string
  declare notifyNpc: string
  declare inventoryIndex: number
  declare inventorySource: string
  declare inventory: Array<{ id: string; slot: number }>


                    // id
                         // Original inventory count, despite the legacy name.
                          // id
                                                 // Recovered instance ownership; absent means unknown.

  /**
   *
   */
  constructor() {
    super()

    this.flags = new Flags()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  } }
