import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'
import { didTargetEntityMove } from '../../Utils'

export default {
  IsAlreadyMoving(context: AiContext) {
    let { entity } = context
    let { aiState } = entity.critter

    let moving = aiState.hasAny([
      State.Flags.Moving,
      State.Flags.PlanningToMove
    ])

    if (!moving) {
      return Action.Score100
    }

    return Action.NoScore
  },

  HasTarget(context: AiContext) {
    let { entity } = context
    let { aiState } = entity.critter

    if (typeof context.distanceToTarget === 'number' && context.distanceToTarget > 1) {
      return Action.Score100
    }

    return Action.NoScore
  }
}
