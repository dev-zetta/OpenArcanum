// @flow

import System from '../System'
import ObjectEnum from '../../enums/Object'
import Location from '../../Location'
import type Entity from '../Entity'

export default class Npc extends System {
  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {
    return !!entity.npc
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    super.update(entity, elapsed)

    //if (entity.nearbyEntities)
    //  return;

    // Get entities within vicinity
    if (entity.nearbyEntities) {
      return
    }

    let { base, npc } = entity

    entity.nearbyEntities = this.map.getEntitiesInRange({
      types: [ObjectEnum.Entity.Npc, ObjectEnum.Entity.Pc],
      center: base.location,
      range: npc.getViewRange(),
      ignore: [entity]
    })

    this.processAi(entity, elapsed)

    this.processCombat(entity, elapsed)
    this.processMovement(entity, elapsed)

    entity.nearbyEntities = null
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {}

  /**
   *
   * @param entity
   */
  exit(entity: Entity) {}

  /**
   *
   * @param entity
   * @param elapsed
   */
  processAi(entity: Entity, elapsed: number) {
    let evaluator = this.map.aiSystem.getEvaluator(`npc`)
    let result = evaluator.process({
      entity,
      Enums: ObjectEnum
    })

    if (result.score <= 0) {
      return
    }

    // Call AI action
    //console.log(result)
    let actionName = AGate.Utils.camelCase(result.action)
    this[actionName].call(this, entity)
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processMovement(entity: Entity, elapsed: number) {
    let { base, npc } = entity

    if (!npc.aiState.has(ObjectEnum.AiState.Moving)) {
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
  processCombat(entity: Entity, elapsed: number) {
    let { base, npc, targetEntity } = entity

    if (!targetEntity) {
      return
    }

    //console.log(attacking.id)
    let distance = Location.calculateDistance(
      base.location,
      targetEntity.base.location
    )

    if (!npc.hasRangedWeapon()) {
      // Is close enough for meelee attack?
      if (distance > npc.getMeeleDistance()) {
        let moving = npc.aiState.hasAny([
          ObjectEnum.AiState.Moving,
          ObjectEnum.AiState.PlanningToMove
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
        if (npc.aiState.has(ObjectEnum.AiState.PreparingToAttack)) {
          npc.aiState.remove([
            ObjectEnum.AiState.Moving,
            ObjectEnum.AiState.PreparingToAttack
          ])
          npc.aiState.set(ObjectEnum.AiState.Attacking)

          this.changeVisual(entity, {
            animation: `Attack`,
            weapon: `Default`
          })
        }
      }
    }
  }

  // ACTIONS

  /**
   *
   * @param entity
   */
  moveToWaypoint(entity: Entity) {
    let { base, npc } = entity

    //if (npc.aiState.has(ObjectEnum.AiState.MovingToWaypoint))
    //  return;

    npc.aiState.set(ObjectEnum.AiState.MovingToWaypoint)

    //if (npc.currentWaypoint == 0)
    //  return;

    if (npc.currentWaypoint == null) {
      npc.currentWaypoint = 1
    } else {
      npc.currentWaypoint += 1
      if (npc.currentWaypoint === npc.waypoints.length) {
        npc.currentWaypoint = 0
      }
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
  attackNearby(entity: Entity) {
    let { base, npc } = entity

    for (let another of entity.nearbyEntities) {
      //console.log(entity.id, another.id );
      entity.targetEntity = another

      npc.aiState.set(ObjectEnum.AiState.PreparingToAttack)
      break
    }
  }

  /**
   *
   * @param entity
   * @param location
   * @param nextTo
   */
  moveToLocation(entity: Entity, location: Location, nextTo: boolean = false) {
    let { base, npc } = entity

    console.log(`Moving to: ${base.location}`)

    entity.moved = false

    if (npc.aiState.has(ObjectEnum.AiState.Moving)) {
      npc.aiState.remove(ObjectEnum.AiState.Moving)
    }

    npc.aiState.set(ObjectEnum.AiState.PlanningToMove)

    let path = this.map.pathFind.findPath(base.location, location)
    if (path.length === 0) {
      npc.aiState.remove(ObjectEnum.AiState.PlanningToMove)
      return
    }

    base.movementPath.clear()
    base.movementPath.addPoints(path)
    base.movementPath.start(nextTo)

    this.changeVisual(entity, { animation: `Walk`})

    this.engine.client.scene.highlightTiles(path)
    //console.log(path);

    npc.aiState.remove(ObjectEnum.AiState.PlanningToMove)
    npc.aiState.set(ObjectEnum.AiState.Moving)
  }

  /**
   *
   * @param entity
   * @param options
   */
  changeVisual(entity: Entity, options: Object) {
    let {classes} = entity.visual
    classes._change = options
    classes.current = Object.assign(classes.current, options)
  }
}
