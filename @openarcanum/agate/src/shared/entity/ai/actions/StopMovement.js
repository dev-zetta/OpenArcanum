import type Entity from '../../Entity'
import Action from '../Action'
import { AiState } from '../../Enums'
import * as Enums from '../../Enums'

export default class StopMovement extends Action {

  /**
   *
   * @param context
   */
  onSstart(context) {
    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState, movementPath } = critter
    //if (npc.aiState.has(AiState.MovingToWaypoint))
    //  return;

    let currentWaypoint = movementPath.currentWaypoint
    let { location, offset } = entity.base

    location.x = currentWaypoint.x
    location.y = currentWaypoint.y
    //offset.zero()

    movementPath.clear()
    aiState.remove([AiState.Moving, AiState.MovingToWaypoint])
  }

  onStop(context) {}

  onUpdate(elapsed: number, context: Object) {

  }
}

StopMovement.Scorers = {
  IsBlocked(context) {
    let { entity } = context
    let { aiState, movementPath } = entity.critter

    if (
      !movementPath.nextTo &&
      this.world.isTileBlocked(movementPath.nextWaypoint)
    ) {
      return 100
    }

    return 0
  }
}

