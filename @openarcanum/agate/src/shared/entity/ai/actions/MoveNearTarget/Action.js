import Action from '../../Action'
import State from '../../State'
import { didTargetEntityMove } from '../../Utils'

export default class MoveNearTarget extends Action {
  build(context) {
    let { entity } = context
    let { base, critter, state } = entity
    let { aiState } = critter

    let { targetEntity } = state

    return {
      onStart() {
        context.target = {
          location: targetEntity.base.location,
          nextTo: true
        }
      },

      onStop() {
        delete context.target
      },

      onUpdate() {
        // if (context.distanceToTarget <= context.minDistance) {
        //   return false
        // }
        return true
      }
    }
  }
}
