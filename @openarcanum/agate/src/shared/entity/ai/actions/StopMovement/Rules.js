import Action from '../../Action'
import State from '../../State'

export default {
  IsMoving(context) {
    let { entity } = context
    let { aiState } = entity.critter
    if (!aiState.hasAny([State.Flags.Moving])) {
      return
    }

    return Action.Score100
  },

  IsBlocked(context) {
    let {
      entity,
      entity: {
        critter: { aiState, movementPath },
        world
      }
    } = context

    if (movementPath.nextTo && world.isTileBlocked(movementPath.nextWaypoint)) {
      return Action.Score100
    }
  }
}
