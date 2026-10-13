// @flow

import Component from './Component'
import Flags from '../../Flags'

export default class Container extends Component {
  lockDifficulty: number
  keyId: string
  notifyNpc: string // id
  inventoryIndex: number // Original inventory count, despite the legacy name.
  inventorySource: string // id
  inventory: Array<{ id: string, slot: number }> // Recovered instance ownership; absent means unknown.

  /**
   *
   */
  constructor() {
    super(...arguments)

    this.flags = new Flags()
  }

  init(params) {
    super.init(params)
  }
}
