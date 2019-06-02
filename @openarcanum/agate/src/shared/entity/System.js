// @flow

import ECS from '../../libs/ECS'
import type EntitySystem from './EntitySystem'
import type GameEngine from '../GameEngine'
import type Entity from './Entity';


export default class System extends ECS.System {

  /**
   *
   * @param engine
   * @param ecs
   */
  constructor(engine: GameEngine, ecs: EntitySystem) {
    super()

    this.engine = engine
    this.ecs = ecs
    this.totalElapsed = 0
  }

  /**
   *
   * @returns {*}
   */
  get map() {
    return this.engine.map
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    this.totalElapsed += elapsed
  }
}
