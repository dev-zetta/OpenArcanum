import type { AiContext, ActionCallbacks } from '../../AiTypes'
import Action from '../../Action'
import State from '../../State'

//@isTestable(true)
class StopMovement extends Action {
  options = {}

  /**
   *
   * @param context
   */
  onStart() {
    lle(`stopped`)

    //this.stop()
  }

  onStop() {}

  onUpdate(_elapsed: number): boolean { return false }
}

export default StopMovement
