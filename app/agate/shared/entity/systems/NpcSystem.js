/* global AGate */

import { System } from '../System'
import Enums from '../../enums'
import { Location } from '../../Location'

export class NpcSystem extends System {
  test(entity) {
    return !!entity.npc
  }

  update(entity, elapsed) {
    super.update(entity, elapsed)

    //if (entity.nearbyEntities)
    //  return;

    // Get entities within vicinity
    if (entity.nearbyEntities) return

    this.processAll(entity, elapsed)
  }

  enter(entity) {}

  exit(entity) {}

  processAll(entity, elapsed) {
    let { base, npc } = entity

    return

    entity.nearbyEntities = this.map.getEntitiesInRange({
      types: [Enums.Entity.Npc, Enums.Entity.Pc],
      center: base.location,
      range: npc.getViewRange(),
      ignore: [entity]
    })

    this.processAi(entity, elapsed)

    this.processCombat(entity, elapsed)
    this.processMovement(entity, elapsed)
    this.processVisual(entity, elapsed)

    entity.nearbyEntities = null
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processVisual(entity, elapsed) {
    let visualClass = entity.getCurrentVisual()
    if (!visualClass) return

    let sprite = visualClass.sprite

    sprite.update(elapsed, entity.getVisualRate())
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processAi(entity, elapsed) {
    let evaluator = this.map.aiSystem.getEvaluator('npc')
    console.log('evaluator')
    let result = evaluator.process({
      entity,
      Enums
    })

    if (result.score <= 0) return

    // Call AI action
    console.log(result)
    let actionName = AGate.Utils.camelCase(result.action)
    this[actionName].call(this, entity)
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processMovement(entity, elapsed) {
    let { base, npc } = entity

    if (!npc.aiState.has(Enums.AiState.Moving)) {
      entity.moved = false
      return
    }

    let moved = base.movementPath.process(entity, elapsed)

    if (!moved) {
      //npc.aiState.remove([Enums.AiState.Moving, Enums.AiState.MovingToWaypoint]);
      base.movementPath.clear()
      /*if (npc.aiState.has(Enums.AiState.MovingToWaypoint)) {

      }*/
    }
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processCombat(entity, elapsed) {
    let { base, npc, targetEntity } = entity

    if (!targetEntity) return

    //console.log(attacking.id)
    let distance = Location.calculateDistance(
      base.location,
      targetEntity.base.location
    )

    if (!npc.hasRangedWeapon()) {
      // Is close enough for meelee attack?
      if (distance > npc.getMeeleDistance()) {
        let moving = npc.aiState.hasAny([
          Enums.AiState.Moving,
          Enums.AiState.PlanningToMove
        ])
        if (
          !moving ||
          (moving && targetEntity.moved) /*&& !npc.movementPath.movedDistance*/
        ) {
          console.log(moving, targetEntity.moved)
          this.moveToLocation(entity, targetEntity.base.location, true)
        } else {
        }
      } else {
        // Already close
        if (npc.aiState.has(Enums.AiState.PreparingToAttack)) {
          npc.aiState.remove([
            Enums.AiState.Moving,
            Enums.AiState.PreparingToAttack
          ])
          npc.aiState.set(Enums.AiState.Attacking)

          this.changeVisual(entity, {
            animation: 'Attack',
            weapon: 'Default'
          }).then(() => {})
        }
      }
    }
  }

  /**
   *
   * @param entity
   */
  moveToWaypoint(entity) {
    let { base, npc } = entity

    //if (npc.aiState.has(Enums.AiState.MovingToWaypoint))
    //  return;

    npc.aiState.set(Enums.AiState.MovingToWaypoint)

    //if (npc.currentWaypoint == 0)
    //  return;

    if (npc.currentWaypoint == null) {
      npc.currentWaypoint = 1
    } else {
      npc.currentWaypoint++
      if (npc.currentWaypoint == npc.waypoints.length) npc.currentWaypoint = 0
    }

    //console.log(npc.currentWaypoint);

    let waypoint = npc.waypoints[npc.currentWaypoint]

    //console.log(base.location, waypoint)
    this.moveToLocation(entity, waypoint)
    console.log(`waypoint: ${waypoint}`)
  }

  /**
   *
   * @param entity
   */
  attackNearby(entity) {
    let { base, npc } = entity

    for (let another of entity.nearbyEntities) {
      //console.log(entity.id, another.id );
      entity.targetEntity = another

      npc.aiState.set(Enums.AiState.PreparingToAttack)
      break
    }
  }

  /**
   *
   * @param entity
   * @param location
   */
  moveToLocation(entity, location, nextTo = false) {
    let { base, npc } = entity

    console.log(`Moving to: ${base.location}`)

    entity.moved = false

    if (npc.aiState.has(Enums.AiState.Moving)) {
      npc.aiState.remove(Enums.AiState.Moving)
    }

    npc.aiState.set(Enums.AiState.PlanningToMove)

    this.map.pathFind.findPath(base.location, location).then(async path => {
      if (path.length == 0) {
        npc.aiState.remove(Enums.AiState.PlanningToMove)
        return
      }

      base.movementPath.clear()
      base.movementPath.addPoints(path)
      base.movementPath.start(nextTo)

      await this.changeVisual(entity, { animation: 'Walk' })

      this.engine.client.scene.highlightTiles(path)
      //console.log(path);

      npc.aiState.remove(Enums.AiState.PlanningToMove)
      npc.aiState.set(Enums.AiState.Moving)
    })
  }

  /**
   *
   * @param entity
   * @param options
   * @returns {Promise<void>}
   */
  async changeVisual(entity, options) {
    let visualClass = entity.getCurrentVisual()
    if (!visualClass) return

    let sprite = visualClass.sprite

    //this.totalElapsed = 0;
    await sprite.change(options)
  }
}
