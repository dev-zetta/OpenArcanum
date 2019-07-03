import BaseTypes from '../serialize/BaseTypes'
import Serializable from '../serialize/Serializable'

/**
 * Defines a collection of NetworkEvents to be transmitted over the wire
 */
export default class NetworkedEventCollection extends Serializable {
  static get netScheme() {
    return {
      events: {
        type: 'list',
        itemType: 'class'
      }
    }
  }

  constructor(events) {
    super()
    this.events = events || []
  }
}
