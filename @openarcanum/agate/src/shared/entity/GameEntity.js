import Lance from '../../libs/Lance'
//import type Entity from './Entity'

export default class GameEntity extends Lance.DynamicObject {
  /**
   *
   * @param gameEngine
   * @param options
   * @param props
   */
  constructor(gameEngine, options, props) {
    super(gameEngine, options, props)
  }

  /**
   *
   * @param gameEngine
   */
  onAddToWorld(gameEngine) {}

  /**
   *
   * @param gameEngine
   */
  onRemoveFromWorld(gameEngine) {}

  /**
   *
   * @param other
   */
  syncTo(other) {
    super.syncTo(other)
    this.showThrust = other.showThrust
  }

  /**
   *
   */
  destroy() {}

  /**
   *
   */
  attachAI() {}

  /**
   *
   * @returns {*}
   */
  static get netScheme() {
    return Object.assign(
      {
        showThrust: { type: Serializer.TYPES.INT32 }
      },
      super.netScheme
    )
  }
}
