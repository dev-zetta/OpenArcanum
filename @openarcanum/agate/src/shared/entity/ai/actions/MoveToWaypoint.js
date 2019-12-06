import type Entity from '../../Entity'
import Action from '../Action'
import { AiState } from '../../Enums'


export default class MoveToWaypoint extends Action {

  /**
   *
   * @param context
   */
  onStart(context: Object) {
    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState } = critter
    //if (npc.aiState.has(AiState.MovingToWaypoint))
    //  return;

    aiState.set(AiState.MovingToWaypoint)

    //if (npc.currentWaypoint == 0)
    //  return;

    lll(`moving to waypoint`, entity.id, npc.currentWaypoint)

    if (npc.currentWaypoint == null) {
      npc.currentWaypoint = 1
    } else {
      npc.currentWaypoint += 1
      if (npc.currentWaypoint === npc.waypoints.count) {
        npc.currentWaypoint = 0
      }
    }

    let waypoint = npc.waypoints.getAt(npc.currentWaypoint)

    //console.log(base.location, waypoint)
    this.queueAction(`MoveToLocation`, { entity, location: waypoint })
    lll(`waypoint: ${waypoint}`)
  }

  onStop(context: Object) {

    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState } = critter
    aiState.remove(AiState.MovingToWaypoint)
  }

  onUpdate(elapsed: number, context: Object) {

  }

  onChildStopped(action: Action) {
    lll('onChildStopped', action)
    switch (action.name) {
      case 'MoveToLocation': {
        this.stop()
      }
    }
  }
}

MoveToWaypoint.Scorers = {
  // IsAttacking(context = this.context) {
  //   let { entity } = context
  //   let { aiState } = context.entity.critter
  //
  //   if (aiState.hasAny([AiState.Attacking, AiState.PreparingToAttack])) {
  //     return -125
  //   }
  //
  //   return 0
  // }

  HasWaypoints(context) {
    let { entity } = context
    let { npc } = entity
    if (!npc.waypoints || npc.waypoints.count === 0) {
      return Action.Impossible
    }

    return Action.Score50
  },

  IsMoving(context) {
    let { entity } = context
    let { aiState } = entity.critter
    if (
      aiState.hasAny([
        AiState.Moving,
        AiState.MovingToWaypoint,
        AiState.PlanningToMove
      ])
    ) {
      return Action.Impossible
    }

    return Action.Score25
  }
}
