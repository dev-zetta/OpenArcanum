import Action from '../../Action'
import State from '../../State'

export default class AttackNearby extends Action {
  build(context) {
    let { entity } = context
    let { base, critter, npc, state } = entity
    let { aiState } = critter
    let { targetEntity } = context

    return {
      onStart() {
        state.targetEntity = targetEntity
        aiState.set(State.Flags.PreparingToAttack)
      },

      onStop() {
        aiState.remove(State.Flags.PreparingToAttack)
        delete state.targetEntity
        delete context.targetEntity
      },

      onUpdate(elapsed: number) {
        if (aiState.hasAny([State.Flags.IsDead])) {
          return false
        }

        if (targetEntity.critter.aiState.hasAny([State.Flags.IsDead])) {
          return false
        }

        context.distanceToTarget = base.location.distanceTo(
          targetEntity.base.location
        )

        let minDistance = 1
        if (!critter.hasRangedWeapon()) {
          minDistance = critter.getMeleeDistance()
        }

        //lle('update attackNearby', context.distanceToTarget)

        context.minDistance = minDistance
        return true
      },

      onChildStarted(action: Action) {
        aiState.remove([State.Flags.PreparingToAttack])
      }
    }
  }


}
