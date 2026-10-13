import type Entity from '../Entity'

import GameComponent from '../../serialize/GameComponent'
import Flags from '../../Flags'

export default class Component extends GameComponent {
  declare static componentName: string

  declare entity: Entity
  declare flags: Flags


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
  init(params: { entity: import("../Entity").default }) {
    //super.init(params)
    this.entity = params.entity
  }
}
