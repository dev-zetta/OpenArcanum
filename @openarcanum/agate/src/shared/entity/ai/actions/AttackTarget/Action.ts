import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'
import {Interval} from '../../Utils';

export default class AttackTarget extends Action {
  build(context: AiContext): ActionCallbacks {
    let { entity, targetEntity } = context
    if (!targetEntity) return {}
    let { base, critter, npc } = entity
    let { aiState } = critter

    let trigger = new Interval(critter.getAttackSpeed())

    return {
      onStart() {
        lll(`starting attack`)
        aiState.set(State.Flags.Attacking)

        trigger.start()
      },

      onStop() {
        aiState.remove(State.Flags.Attacking)
      },

      onUpdate(elapsed: number) {
        if (typeof context.distanceToTarget === 'number' && typeof context.minDistance === 'number' && context.distanceToTarget > context.minDistance) {
          return false
        }

        if (trigger.hit()) {
          targetEntity.base.health.damage += 5
          let points = targetEntity.critter.currentHealth()

          if (points <= 0) {
            targetEntity.critter.aiState.set(State.Flags.IsDead)
          }

          lle('points', points)
          return false
        }

        return true
      }
    }
  }
}
