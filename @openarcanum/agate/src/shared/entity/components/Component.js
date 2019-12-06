// @flow

import type Entity from '../Entity'
import GameComponent from '../../serialize/GameComponent'
import Flags from '../../Flags'

export default class Component extends GameComponent {
  entity: Entity
  flags: Flags
  /**
   *
   * @param entity
   */
  constructor() {
    super()

    this.flags = new Flags()
  }

  /**
   *
   * @param params
   * @param data
   */
  init(params) {
    //super.init(params)
    this.entity = params.entity
  }
}
