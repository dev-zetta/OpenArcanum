import Action from '../../Action'
import State from '../../State'
import {Interval} from '../../Utils';

export default class AttackTarget extends Action {
  build(context) {
    let { entity, targetEntity } = context
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
        if (context.distanceToTarget > context.minDistance) {
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
