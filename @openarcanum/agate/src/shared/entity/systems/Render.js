// @flow

import System from '../System'
import * as Enums from '../Enums'
import type Entity from '../Entity'
import { State as AiState } from '../../entity/ai'
import State from '../ai/State'
import Location from '../../Location'

const WithAnimation = [
  Enums.Entity.Portal,
  Enums.Entity.Scenery,
  Enums.Entity.Container,
  Enums.Entity.Projectile,
  Enums.Entity.Pc,
  Enums.Entity.Npc
]

export default class Render extends System {
  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {
    return (
      !!entity.visual &&
      WithAnimation.includes(Enums.Entity.get(entity.base.type))
    )
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
      let { critter, npc } = entity
      let { aiState } = critter

      if (aiState.has(AiState.Flags.Moving)) {
        let speed = critter.getMovementSpeed()
        rate = speed
      } else if (aiState.has(AiState.Flags.Attacking)) {
        let speed = critter.getAttackSpeed()
        rate = speed
      } else {
        rate = 1.0
      }
    }

    return rate
  }

  updateNpc(entity) {
    let {
      base,
      critter: { aiState, movementPath },
      state: { targetEntity }
    } = entity

    let update = {}
    if (aiState.counter > 0) {
      aiState.counter = 0

      update = {
        weapon: `Unarmed`,
        shield: `None`
        //frame: 0
      }

      //update.frame = 0
      if (aiState.hasAny([AiState.Flags.IsDead])) {
        update.animation = `FallDown`
      } else {

        if (aiState.hasAny([AiState.Flags.Moving])) {
          update.animation = `Walk`

          if (this.gameEngine.client) {
            this.gameEngine.client.scene.highlightTiles(movementPath.waypoints)
          }
        } else {
          update.animation = `Stand`
        }

        if (aiState.hasAny([AiState.Flags.PreparingToAttack])) {
          update.frame = 0
        }

        if (aiState.hasAny([AiState.Flags.Attacking])) {
          update.animation = `Attack`
          update.weapon = `Default`

          let velocity = Location.calculateVelocity(
            base.location,
            targetEntity.base.location
          )

          let direction = Location.velocityToDirection(velocity)
          update.stage = String(direction)
        }
      }
    } else {
      // if (movementPath.valid()) {
      //  update = {}
      //   update.stage = movementPath.directionName
      // }
    }

    // lle(update)

    // for (let [name, action] of aiState.actions) {
    //   switch (name) {
    //     lle(name)
    //   }
    // }

    return update
  }

  /**
   *
   * @param entity
   * @param dx
   * @param dy
   * @returns {boolean}
   */
  // updateSprite(entity: Entity, direction: string, dx: ?number, dy: ?number) {
  //   lll('update sprite')
  //
  //   let visualClass = entity.visual.getCurrent()
  //
  //   if (!visualClass) {
  //     lll(`visual not found`, entity)
  //     return false
  //   }
  //
  //   let sprite = visualClass.sprite
  //   if (!sprite || !sprite.isValid()) {
  //     //lll('sprite not found', entity)
  //     return false A7w6FLGdNfnqWc8
  //   }
  //
  //   lll(direction)
  //   sprite.setStage(direction)
  //
  //   if (true /*dx !== null && dy !== null*/) {
  //     //lll('sprite move', dx, dy)
  //     const { location, offset } = entity.base
  //     //lll('aaa', sprite.iso.isoPosition, dx, dy, offset)
  //     sprite.setPosition(location.x * 40 + offset.x, location.y * 40 + offset.y)
  //     //lll('aab', sprite.iso.isoPosition)
  //   }
  //
  //   return true
  // }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processVisual(entity: Entity, elapsed: number) {
    let {
      base,
      visual: { classes }
    } = entity
    if (!classes) {
      return
    }

    let { sprite } = classes.current
    if (!sprite) {
      return
    }

    let update = null

    switch (base.type) {
      case `Npc`: {
        update = this.updateNpc(entity)

        let { critter } = entity

        const { location, offset } = base
        //lll('aaa', sprite.iso.isoPosition, dx, dy, offset)
        sprite.setPosition(
          location.x * 40 + offset.x,
          location.y * 40 + offset.y
        )

        if (!update.stage && critter.movementPath.valid()) {
          update.stage = critter.movementPath.directionName
        }

        break
      }
    }

    if (update) {
      //lle(update)
      let propsChanged = 0
      for (let prop in update) {
        if (classes.current[prop] != update[prop]) {
          lle(prop, classes.current[prop], update[prop])
          classes.current[prop] = update[prop]
          propsChanged++
        }
      }
      if (propsChanged > 0) {
        sprite.change(classes.current)
        //lle(update, classes.current)
      }
    }

    //if (this.getVisualRate(entity) != 1)
    //lle(elapsed, this.getVisualRate(entity))

    sprite.update(elapsed, this.getVisualRate(entity))
  }

  /**
   *
   * @param entity
   * @param options
   */
  // changeVisual(entity: Entity, options: Object) {
  //   let { classes } = entity.visual
  //   entity.state.visualUpdate = Object.assign({}, entity.visualUpdate, options)
  // }
}
