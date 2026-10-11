// @flow
import System from '../System'
import * as Enums from '../Enums'
import Location from '../../Location'
import type Entity from '../Entity'
import Utils from '../../misc/Utils'

//
// 'E505FDB5-0E4E-11D4-8F1D-00E02920220C'

export default class Npc extends System {
  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {
    return !!entity.critter
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    this.limitTo = [
      `E505FDB4-0E4E-11D4-8F1D-00E02920220C`,
      "E505FDB5-0E4E-11D4-8F1D-00E02920220C"
    ]

    super.update(entity, elapsed)

    if (this.limitTo && !this.limitTo.includes(entity.id)) {
      return
    }

    let { base, critter, npc, state } = entity

    // Get entities within vicinity
    //if (state.nearbyEntities) {
    //  return
    //}

    if (!entity.world) {
      debugger
    }

    if (state.targetEntity) {
      state.nearbyEntities = []
    } else {
      state.nearbyEntities = entity.map.getEntitiesInRange({
        types: [Enums.Entity.Npc, Enums.Entity.Pc],
        center: base.location,
        range: critter.getViewRange(),
        ignore: [entity]
      })
    }

    this.processAi(entity, elapsed)

    this.processCombat(entity, elapsed)
    this.processMovement(entity, elapsed)

    //state.nearbyEntities = null;
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {
    lll(`NPC enter`, entity)
  }

  /**
   *
   * @param entity
   */
  exit(entity: Entity) {
    lll(`NPC leave`, entity)
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processAi(entity: Entity, elapsed: number) {
    entity.world.aiSystem.updateEntity(entity, elapsed)
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processMovement(entity: Entity, elapsed: number) {}

  /**
   *
   * @param entity
   * @param elapsed
   */
  processCombat(entity: Entity, elapsed: number) {}
}
