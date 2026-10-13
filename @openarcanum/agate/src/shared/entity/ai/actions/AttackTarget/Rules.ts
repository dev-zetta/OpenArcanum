import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'

export default {
  IsTargetNear(context: AiContext) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { targetEntity } = state

    let { aiState } = critter

    // if (aiState.hasAny([State.Flags.IsDead])) {
    //   return
    // }


    // if (targetEntity.critter.aiState.hasAny([State.Flags.IsDead])) {
    //   return
    // }


    if (typeof context.distanceToTarget === 'number' && typeof context.minDistance === 'number' && context.distanceToTarget <= context.minDistance) {
      return Action.Score100
    }

    // lle('too far', context.distanceToTarget, context.minDistance)
    return Action.NoScore
  }
}
