// @flow

import Component from './Component'
import Flags from '../../Flags';

export default class Container extends Component {
  lockDifficulty: number
  keyId: string
  notifyNpc: string // id
  inventoryIndex: string
  inventorySource: string // id

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
