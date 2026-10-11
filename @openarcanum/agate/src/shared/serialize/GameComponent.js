// @flow

import Serializable from '../serialize/Serializable'

export default class GameComponent extends Serializable {
  constructor() {
    super()

  }

  static get name() {
    return this.constructor.name
  }

  static get netScheme() {
    return null
  }
}
