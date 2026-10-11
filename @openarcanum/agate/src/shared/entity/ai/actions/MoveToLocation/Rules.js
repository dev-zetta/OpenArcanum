import Action from '../../Action'
import State from '../../State'
import { didTargetEntityMove } from '../../Utils'

export default {
  IsAlreadyMoving(context) {
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

  HasTarget(context) {
    let { entity } = context
    let { aiState } = entity.critter

    if (context.distanceToTarget > 1) {
      return Action.Score100
    }

    return Action.NoScore
  }
}
