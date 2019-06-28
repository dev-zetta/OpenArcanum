// @flow

import type Entity from '../Entity'
import type Prototype from '../Prototype'
import GameComponent from '../../serialize/GameComponent'
import Utils from '../../misc/Utils'

export default class Component extends GameComponent {
  entity: Entity

  /**
   *
   * @param entity
   */
  constructor() {
    super()
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

  /*static copyProps(target, data, except = null) {
    for (let key in data) {
      if (!except || except.indexOf(key) === -1) {
        target[key] = data[key]
      }
    }
  }*/
}
