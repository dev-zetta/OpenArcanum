import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'

export default {
  // IsAttacking(context = this.context) {
  //   let { entity } = context
  //   let { aiState } = context.entity.critter
  //
  //   if (aiState.hasAny([State.Flags.Attacking, State.Flags.PreparingToAttack])) {
  //     return -125
  //   }
  //
  //   return 0
  // }

  HasWaypoints(context: AiContext) {
    let { entity } = context
    let { aiState } = entity.critter

    if (aiState.hasAny([State.Flags.IsDead])) {
      return
    }

    let { npc } = entity
    if (!npc?.waypoints || npc.waypoints.count === 0) {
      return
    }

    return Action.Score100
  },

  IsMoving(context: AiContext) {
    let { entity } = context
    let { aiState } = entity.critter
    if (
      aiState.hasAny([
        State.Flags.Moving,
        State.Flags.MovingToWaypoint,
        State.Flags.PlanningToMove
      ])
    ) {
      return
    }

    return Action.Score100
  }
}
