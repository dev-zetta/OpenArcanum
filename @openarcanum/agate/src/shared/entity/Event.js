/**
 * @constructor
 */
export default class Event {
  constructor(name, callback) {
    this._name = name || `name`
    this._callback = callback || null

    // Additional filters
    this._Components = []
    this._entity = null
  }

  /**
   * @param {String} eventName
   * @param {{hasAllComponents:Function}} entity
   * @param {Object=} option
   * @return {Boolean} True if fired.
   */
  fire(eventName, entity, option) {
    // Name check
    if (eventName !== this._name) {
      return false
    }

    // Component filters
    const Comps = this._Components
    if (entity && entity.hasAllComponents && Comps.length) {
      if (!entity || !entity.hasAllComponents(Comps)) {
        return false
      }
    }

    // Entity filter
    if (this._entity !== null && this._entity !== entity) {
      return false
    }

    // Made it
    this._callback(entity, option)
    return true
  }

  /**
   * @param {Entity} entity The entity that the event has to match.
   * @return {Event} This object.
   */
  whereEntity(entity) {
    if (this._entity) {
      throw new Error(`Cannot call whereEntity twice`)
    }
    this._entity = entity
    return this
  }

  /**
   * @param {Function} T
   * @return {Event} This object.
   */
  whereComponent(T) {
    this._Components.push(T)
    return this
  }

  /**
   * @param {Array.<Function>} Components
   * @return {Event} This object.
   */
  whereComponents(Components) {
    this._Components = this._Components.concat(Components)
    return this
  }
}
