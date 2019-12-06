import Action from '../Action'
import { AiState } from '../../Enums'

export default class MoveToLocation extends Action {

  /**
   *
   * @param context
   */
  onStart(context) {

    let { entity, location, nextTo } = context
    let { base, critter, npc, world } = entity
    let { movementPath, aiState } = critter

    console.log(`Moving to: ${location}`)

    //if (aiState.has(Enums.AiState.Moving)) {
    aiState.remove(AiState.Moving)
    //}

    aiState.set(AiState.PlanningToMove)

    let path = world.pathFind.findPath(base.location, location)
    if (path.length === 0) {
      lll(`Path not found`)
      aiState.remove(AiState.PlanningToMove)
      return
    }

    movementPath.clear()
    movementPath.addPoints(path)
    movementPath.start(nextTo)

    aiState.remove(AiState.PlanningToMove)
    aiState.set(AiState.Moving)
  }

  onStop(context) {

    let { entity } = context
    let { base, critter, npc } = entity
    let { movementPath, aiState } = critter

    movementPath.clear()

    aiState.remove(AiState.Moving)
  }

  /**
   *
   * @param elapsed
   * @param context
   * @returns {boolean}
   */
  onUpdate(elapsed: number, context: Object) {


    let { entity } = context
    let { base, critter, npc } = entity
    let { aiState, movementPath } = critter

    if (!aiState.has(AiState.Moving)) {
      //entity.moved = false
      return false
    }

    let moved = movementPath.process(entity, elapsed)

    if (!moved) {
      //npc.aiState.remove([Enums.AiState.Moving, Enums.AiState.MovingToWaypoint]);
      //critter.movementPath.clear()
      /*if (npc.aiState.has(Enums.AiState.MovingToWaypoint)) {

      }*/
      this.stop()


    }
    return true
  }
}

MoveToLocation.Scorers =  {

}
