import AttackNearby from './actions/AttackNearby'
import AttackTarget from './actions/AttackTarget'
import MoveToWaypoint from './actions/MoveToWaypoint'
import MoveToLocation from './actions/MoveToLocation'

const Evaluators = {
  Pc: {
    actions: {
      MoveToLocation,
      AttackTarget
    }
  },
  Npc: {
    actions: {
      MoveToWaypoint,
      MoveToLocation,
      AttackNearby,
      AttackTarget
    }
  }
}

export default Evaluators
