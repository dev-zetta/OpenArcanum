// @flow
/* global AGate */

import System from '../System'
import Object from '../../enums/Object'
import type Entity from '../Entity'

export default class Render extends System {
  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {
    return !!entity.visual
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {}





  /**
   *
   * @param entity
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    super.update(entity, elapsed)
    this.processVisual(entity, elapsed)
  }

  /**
   *
   * @param entity
   */
  exit(entity: Entity) {}

  /**
   *
   * @returns {number}
   */

  getVisualRate(entity: Entity): number {
    let rate = 1.0

    if (entity.npc) {
      let { npc } = entity

      if (npc.aiState.has(Object.AiState.Moving)) {
        let speed = npc.getMovementSpeed()
        rate = speed
      } else if (npc.aiState.has(Object.AiState.Attacking)) {
        let speed = npc.getAttackSpeed()
        rate = speed
      } else {
        rate = 0.1
      }
    }

    return rate
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processVisual(entity: Entity, elapsed: number) {
    let {classes} = entity.visual
    if (!classes) {
      return
    }

    let sprite = classes.current.sprite
    if (classes._change) {
      //this.totalElapsed = 0;
      sprite.change(classes._change)
      delete classes._change
    }

    sprite.update(elapsed, this.getVisualRate(entity))
  }
}
