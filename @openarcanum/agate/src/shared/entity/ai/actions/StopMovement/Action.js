import Action from '../../Action'
import State from '../../State'

//@isTestable(true)
class StopMovement extends Action {
  options = {}

  /**
   *
   * @param context
   */
  onStart(context) {
    lle(`stopped`)

    //this.stop()
  }

  onStop(context) {}

  onUpdate(elapsed: number, context: Object) {}
}

export default StopMovement
