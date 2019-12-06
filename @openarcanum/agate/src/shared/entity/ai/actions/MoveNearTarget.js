import Action from '../Action'
import { AiState } from '../../Enums'

export default class MoveNearTarget extends Action {

  /**
   *
   * @param context
   */
  onStart(context) {

    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = critter

    let { targetEntity } = state

    this.queueAction(`MoveToLocation`, {
      entity,
      location: targetEntity.base.location,
      nextTo: true
    })
  }

  onStop(context) {

    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = critter
    aiState.remove(AiState.PreparingToAttack)
  }

  onUpdate(elapsed: number, context: Object) {

  }


  static didTargetEntityMove(entity) {
    return !entity.critter.movementPath.isTargetSame(
      entity.state.targetEntity.base.location
    )
  }
}

MoveNearTarget.Scorers = {

  HasTargetMoved(context) {
    let { entity } = context
    let { aiState } = entity.critter

    let moving = aiState.hasAny([AiState.Moving, AiState.PlanningToMove])

    if (!moving || (moving && MovetNearTarget.didTargetEntityMove(entity))) {
      return Action.Score100
    }

    return Action.NoScore
  },


}
