import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'

export default {
  IsMoving(context: AiContext) {
    let { entity } = context
    let { aiState } = entity.critter
    if (!aiState.hasAny([State.Flags.Moving])) {
      return
    }

    return Action.Score100
  },

  IsBlocked(context: AiContext) {
    let {
      entity,
      entity: {
        critter: { aiState, movementPath },
        world
      }
    } = context

    if (movementPath.nextTo && movementPath.nextWaypoint && entity.map.isTileBlocked(movementPath.nextWaypoint.x, movementPath.nextWaypoint.y)) {
      return Action.Score100
    }
  }
}
