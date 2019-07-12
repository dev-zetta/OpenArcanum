// @flow
import System from '../System'
import * as Enums from '../../enums/Entity'
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
    //this.limitTo = 'E505FDB4-0E4E-11D4-8F1D-00E02920220C'


    super.update(entity, elapsed)

    if (this.limitTo && entity.id !== this.limitTo ) {
      return
    }

    // Get entities within vicinity
    if (entity.nearbyEntities) {
      return
    }

    let { base, critter, npc } = entity

    if (entity.targetEntity) {
      entity.nearbyEntities = []
    } else {
      entity.nearbyEntities = this.map.getEntitiesInRange({
        types: [Enums.Entity.Npc, Enums.Entity.Pc],
        center: base.location,
        range: critter.getViewRange(),
        ignore: [entity]
      })
    }

    this.processAi(entity, elapsed)

    this.processCombat(entity, elapsed)
    this.processMovement(entity, elapsed)

    entity.nearbyEntities = null
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {
    lll(`NPC enter`, entity)

    entity.onTileEnter = (origin: Location, target: Location) =>{
      //lll('onTileEnter', {origin, target})
      this.map.moveEntity(entity, origin, target)
    }


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
    let evaluator = this.map.aiSystem.getEvaluator(entity.base.type)

    let result = evaluator.process({
      entity,
      Enums
    })

    if (result.score <= 0 || !result.action) {
      return
    }

    // Call AI action
    lll(`action`, result.action, entity.id)
    let actionName = Utils.camelCase(result.action)
    this[actionName].call(this, entity)
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  processMovement(entity: Entity, elapsed: number) {
    let { base, critter, npc } = entity
    let { aiState, movementPath } = critter

    if (!aiState.has(Enums.AiState.Moving)) {
      //entity.moved = false
      return
    }

    let moved = movementPath.process(entity, elapsed)

    if (!movementPath.nextTo && this.map.isTileBlocked(movementPath.nextWaypoint)) {
      let currentWaypoint = movementPath.currentWaypoint
      let {location, offset} = entity.base

      location.x = currentWaypoint.x
      location.y = currentWaypoint.y
      //offset.zero()

      movementPath.clear()
      aiState.remove([Enums.AiState.Moving, Enums.AiState.MovingToWaypoint])
      this.changeVisual(entity, {animation: `Stand`, frame: 0 })
      lle('target blocked')
      return
    }




    if (!moved) {
      //npc.aiState.remove([Enums.AiState.Moving, Enums.AiState.MovingToWaypoint]);
      //critter.movementPath.clear()
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
    let { base, critter, npc, targetEntity } = entity
    let { aiState } = critter

    if (!targetEntity) {
      return
    }

    //console.log(attacking.id)
    let distance = Location.calculateDistance(
      base.location,
      targetEntity.base.location
    )

    if (!critter.hasRangedWeapon()) {
      // Is close enough for meelee attack?
      //lll('distance', distance, critter.getMeleeDistance())

      if (distance > critter.getMeleeDistance()) {
        let moving = aiState.hasAny([
          Enums.AiState.Moving,
          Enums.AiState.PlanningToMove
        ])

        if (
          !moving ||
          (moving &&
            this.didTargetEntityMove(
              entity
            ))


        ) {
          //lll(`aaa`, moving)
          this.moveToLocation(entity, targetEntity.base.location, true)
        } else {
        }
      } else {
        // Already close
        if (aiState.has(Enums.AiState.PreparingToAttack)) {
          lll(`starting attack`)

          aiState.remove([
            Enums.AiState.Moving,
            Enums.AiState.PreparingToAttack
          ])
          aiState.set(Enums.AiState.Attacking)

          this.changeVisual(entity, {
            animation: `Attack`,
            weapon: `Default`
          })
        }
      }
    }
  }

  didTargetEntityMove(entity) {
    return !entity.critter.movementPath.isTargetSame(
      entity.targetEntity.base.location
    )
  }

  // AI - ACTIONS

  /**
   *
   * @param entity
   */
  moveToWaypoint(entity: Entity) {
    let { base, critter, npc } = entity
    let { aiState } = critter
    //if (npc.aiState.has(Enums.AiState.MovingToWaypoint))
    //  return;

    aiState.set(Enums.AiState.MovingToWaypoint)

    //if (npc.currentWaypoint == 0)
    //  return;

    lll('moving to waypoint', entity.id, npc.currentWaypoint)

    if (npc.currentWaypoint == null) {
      npc.currentWaypoint = 1
    } else {
      npc.currentWaypoint += 1
      if (npc.currentWaypoint === npc.waypoints.count) {
        npc.currentWaypoint = 0
      }
    }

    //console.log(npc.currentWaypoint);

    let waypoint = npc.waypoints.getAt(npc.currentWaypoint)

    //console.log(base.location, waypoint)
    this.moveToLocation(entity, waypoint)
    console.log(`waypoint: ${waypoint}`)
  }

  /**
   *
   * @param entity
   */
  attackNearby(entity: Entity) {
    let { base, critter, npc } = entity
    let { aiState } = critter

    for (let another of entity.nearbyEntities) {
      lll(`attackNearby`, entity.id, another.id)
      entity.targetEntity = another

      aiState.set(Enums.AiState.PreparingToAttack)
      aiState.remove(Enums.AiState.MovingToWaypoint)
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
    let { base, critter, npc } = entity
    let { movementPath, aiState } = critter

    console.log(`Moving to: ${base.location}`)

    //if (aiState.has(Enums.AiState.Moving)) {
    aiState.remove(Enums.AiState.Moving)
    //}

    aiState.set(Enums.AiState.PlanningToMove)

    let path = this.map.pathFind.findPath(base.location, location)
    if (path.length === 0) {
      aiState.remove(Enums.AiState.PlanningToMove)
      return
    }

    movementPath.clear()
    movementPath.addPoints(path)
    movementPath.start(nextTo)

    this.changeVisual(entity, { animation: `Walk` })

    if (this.engine.client) {
      this.engine.client.scene.highlightTiles(path)
    }
    //console.log(path);

    aiState.remove(Enums.AiState.PlanningToMove)
    aiState.set(Enums.AiState.Moving)
  }

  /**
   *
   * @param entity
   * @param options
   */
  changeVisual(entity: Entity, options: Object) {
    let { classes } = entity.visual
    entity.visualUpdate = Object.assign({}, entity.visualUpdate, options)
  }
}
