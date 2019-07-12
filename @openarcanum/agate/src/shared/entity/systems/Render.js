// @flow

import System from '../System'
import * as Enums from '../../enums/Entity'
import type Entity from '../Entity'

const WithAnimation = [Enums.Entity.Portal, Enums.Entity.Scenery, Enums.Entity.Container, Enums.Entity.Projectile, Enums.Entity.Pc, Enums.Entity.Npc]

export default class Render extends System {
  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {


    return !!entity.visual && WithAnimation.includes(Enums.Entity.get(entity.base.type))
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {


  }





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
      let { critter, npc } = entity
      let {aiState} = critter

      if (aiState.has(Enums.AiState.Moving)) {
        let speed = critter.getMovementSpeed()
        rate = speed
      } else if (aiState.has(Enums.AiState.Attacking)) {
        let speed = critter.getAttackSpeed()
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

    let {sprite} = classes.current
    if (!sprite) {
      return
    }

    let next = entity.visualUpdate
    if (next) {
      for (let prop in next) {
        classes.current[prop] = next[prop]
      }

      sprite.change(classes.current)
      delete entity.visualUpdate
    }

    sprite.update(elapsed, this.getVisualRate(entity))
  }
}
