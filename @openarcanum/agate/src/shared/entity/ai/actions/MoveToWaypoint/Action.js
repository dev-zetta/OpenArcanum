import Action from '../../Action'
import State from '../../State'

export default class MoveToWaypoint extends Action {
  build(context) {
    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState } = critter

    return {
      onStart() {
        aiState.set(State.Flags.MovingToWaypoint)

        //if (npc.currentWaypoint == 0)
        //  return;

        lll(`moving to waypoint`, entity.id, npc.currentWaypoint)

        if (npc.currentWaypoint == null) {
          npc.currentWaypoint = 1
        } else {
          npc.currentWaypoint += 1
          if (npc.currentWaypoint === npc.waypoints.count) {
            npc.currentWaypoint = 0
          }
        }

        let waypoint = npc.waypoints.getAt(npc.currentWaypoint)

        //console.log(base.location, waypoint)
        context.target = { location: waypoint }
        lll(`waypoint: ${waypoint}`)
      },

      onStop() {
        delete context.target
        aiState.remove(State.Flags.MovingToWaypoint)
      },

      onUpdate(elapsed: number) {
        context.distanceToTarget = base.location.distanceTo(
          context.target.location
        )

        return true
      }
    }
  }

  onChildStopped(action: Action) {}
}
