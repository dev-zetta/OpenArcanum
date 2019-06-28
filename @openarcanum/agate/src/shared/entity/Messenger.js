import Event from './Event.js'

/**
 * General event aggregation with filtering on components or tags.
 * @constructor
 */
export default class Messenger {
  constructor() {
    this._events = {}
    this.fired = 0
    this.handled = 0
  }

  /**
   * @param {String} eventName
   * @param {Function} callback
   * @return {Event}
   */
  listenTo(eventName, callback) {
    if (!this._events[eventName]) {
      this._events[eventName] = []
    }

    const event = new Event(eventName, callback)

    // Dump and chump
    this._events[eventName].push(event)
    return event
  }

  /**
   * @param {String} eventName
   * @param {Object=} entity
   * @param {Option=} option
   */
  trigger(eventName, entity, option) {
    this.fired++

    const events = this._events[eventName]
    if (!events) {
      return
    }

    // Try all events
    for (let n = 0; n < events.length; n++) {
      const event = events[n]
      if (event.fire(eventName, entity, option)) {
        this.handled++
      }
    }
  }

  /**
   * Reset stats (should be done in the primary loop).
   */
  resetCounters() {
    this.fired = this.handled = 0
  }
}
