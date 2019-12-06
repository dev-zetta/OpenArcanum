import Action from '../Action'
import { AiState } from '../../Enums'



export default class AttackNearby extends Action {




  /**
   *
   * @param context
   */
  onStart(context) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = critter


    for (let another of state.nearbyEntities) {
      lll(`attackNearby`, entity.id, another.id)
      state.targetEntity = another

      aiState.set(AiState.PreparingToAttack)

      break
    }
  }

  onStop(context) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = critter
    aiState.remove(AiState.PreparingToAttack)
  }

  onUpdate(elapsed: number, context: Object) {

  }
}

AttackNearby.Scorers = {
  IsAlreadyAttacking(context) {
    let { entity } = context
    let { aiState } = entity.critter

    if (aiState.hasAny([AiState.Attacking, AiState.PreparingToAttack])) {
      return Action.Impossible
    }

    return Action.NoScore
  },

  HasAnyoneInRange(context) {
    let { entity } = context
    let { state } = entity
    let nearby = state.nearbyEntities
    if (!nearby || nearby.length === 0) {
      return Action.Impossible
    }



    return Action.Score50
  }
}
