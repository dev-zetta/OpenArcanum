import Action from '../../Action'
import State from '../../State'

export default {
  IsTargetNear(context) {
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


    if (context.distanceToTarget <= context.minDistance) {
      return Action.Score100
    }

    // lle('too far', context.distanceToTarget, context.minDistance)
    return Action.NoScore
  }
}
