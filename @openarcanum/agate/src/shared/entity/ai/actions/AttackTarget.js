import Action from '../Action'
import { AiState } from '../../Enums'
import Location from '../../../Location'



export default class AttackTarget extends Action {

  /**
   *
   * @param entity
   */
  onStart(context) {
    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState } = critter

    lll(`starting attack`)

    aiState.remove([AiState.Moving, AiState.PreparingToAttack])
    aiState.set(AiState.Attacking)
  }

  onStop(context) {
    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState } = critter

    aiState.remove(AiState.Attacking)
  }

  onUpdate(elapsed: number, context: Object) {

  }
}

AttackTarget.Scorers = {
  HasTargetNear(context) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { targetEntity } = state

    if (!targetEntity) {
      return Action.NoScore
    }

    let { aiState } = critter

    //console.log(attacking.id)
    let distance = Location.calculateDistance(
      base.location,
      targetEntity.base.location
    )

    if (!critter.hasRangedWeapon()) {
      // Is close enough for meelee attack?
      //lll('distance', distance, critter.getMeleeDistance())

      if (distance > critter.getMeleeDistance()) {
      } else {
        // Already close
        if (aiState.has(AiState.PreparingToAttack)) {
          // lll('HasTargetNear')

          return Action.Score100
        }
      }
    }
    context.distance = distance
    return Action.NoScore
  }
}
