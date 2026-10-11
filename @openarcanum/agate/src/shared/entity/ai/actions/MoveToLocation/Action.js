import Action from '../../Action'
import State from '../../State'

export default class MoveToLocation extends Action {


  build(context) {
    let { entity, target } = context
    let { base, critter, npc, world, map } = entity
    let { movementPath, aiState } = critter

    return {
      findPath() {
        aiState.set(State.Flags.PlanningToMove)

        let path = map.pathFind.findPath(base.location, target.location)
        if (path.length === 0) {
          lll(`Path not found`, base.location, target.location)
          lll(this.parent.name)
          aiState.remove(State.Flags.PlanningToMove)
          return false
        }

        movementPath.clear()
        movementPath.addPoints(path)
        movementPath.start(target.nextTo)

        aiState.remove(State.Flags.PlanningToMove)
        return true
      },


      onStart() {
        console.log(`Moving to: ${location}`)

        aiState.remove(State.Flags.Moving)

        if (!this.findPath()) {
          return
        }

        aiState.set(State.Flags.Moving)
      },

      onStop() {
        let { location, offset } = entity.base


        let currentWaypoint = movementPath.currentWaypoint
        if (currentWaypoint) {
          //location.x = currentWaypoint.x`
          //location.y = currentWaypoint.y
          //offset.zero()
        }

        movementPath.clear()
        aiState.remove([State.Flags.Moving])
      },

      onUpdate(elapsed: number) {
        if (!aiState.has(State.Flags.Moving)) {
          //entity.moved = false
          //debugger
          return false
        }

        if (!movementPath.isTargetSame(target.location)) {
          if (!this.findPath()) {
            debugger
            return
          }
        }

        let moved = movementPath.process(entity, elapsed)

        if (!moved) {
          //npc.aiState.remove([Enums.State.Flags.Moving, Enums.State.Flags.MovingToWaypoint]);
          //critter.movementPath.clear()
          /*if (npc.aiState.has(Enums.State.Flags.MovingToWaypoint)) {

          }*/
          //this.stop()
          //debugger
          return false
        }
        return true
      }
    }
  }

  onChildStopped(action: Action) {
    lll(`onChildStopped`, action)
  }
}
