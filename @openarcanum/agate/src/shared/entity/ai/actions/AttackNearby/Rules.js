import Action from '../../Action'
import State from '../../State'

export default {
  IsNotAttacking(context) {
    let { entity } = context
    let { aiState } = entity.critter

    if (aiState.hasAny([State.Flags.IsDead])) {
      return
    }

    return Action.Score100
  },

  HasAnyoneInRange(context) {
    let { entity } = context
    let { state } = entity
    let { aiState } = entity.critter

    if (!state.nearbyEntities || state.nearbyEntities.length === 0) {
      return
    }

    let score = 0
    for (let another of state.nearbyEntities) {
      if (another.critter.aiState.hasAny([State.Flags.IsDead])) {
        continue
      }

      //lll(`attackNearby`, entity.id, another.id, another.critter.aiState.hasAny([State.Flags.IsDead]))
      context.targetEntity = another

      score = Action.Score100
      break
    }

    return score
  }
}
