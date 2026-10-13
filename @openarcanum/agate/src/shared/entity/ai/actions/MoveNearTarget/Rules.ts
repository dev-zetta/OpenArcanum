import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'
import { didTargetEntityMove } from '../../Utils'

export default {
  MoveToTarget(context: AiContext) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = entity.critter

    let { targetEntity } = state

    let moving = aiState.hasAny([
      State.Flags.Moving,
      State.Flags.PlanningToMove
    ])

    // if (!moving || (moving && ) {
    //   return Action.Score100
    // }

    if (typeof context.distanceToTarget === 'number' && typeof context.minDistance === 'number' && context.distanceToTarget > context.minDistance) {
      //lle(`distance`, context.distanceToTarget, context.minDistance)
      return Action.Score100
    }

    return Action.NoScore
  }
}
