import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'
import { didTargetEntityMove } from '../../Utils'

export default class MoveNearTarget extends Action {
  build(context: AiContext): ActionCallbacks {
    let { entity } = context
    let { base, critter, state } = entity
    let { aiState } = critter

    let { targetEntity } = state
    if (!targetEntity) return {}

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
        // if (typeof context.distanceToTarget === 'number' && typeof context.minDistance === 'number' && context.distanceToTarget <= context.minDistance) {
        //   return false
        // }
        return true
      }
    }
  }
}
