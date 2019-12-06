export default Transform;

let Vec2 = require(`./Vec2.js`)

/**
 * Basic transform component.
 * @constructor
 */
class Transform {
  constructor() {
    this.position = new Vec2()

    // cached
    this._absPosition = new Vec2()

    this.__init()
  }

  /**
   * Reset for pool.
   */
  __init() {
    this.position.clear()
    this._absPosition.clear()

    this.rotation = 0
    this.scale = 1
    this.parent = null
  }

  /**
   * Absolute world position.
   * @return {Vec2}
   */
  absPosition() {
    let position = this._absPosition.assign(this.position)

    // Trivial case, no parent
    if (!this.parent) {
      return position
    }

    let parent = this.parent

    position

    // Rotate our angle by parent's angle
      .rotate(parent.absRotation())

      // Scale by parents scale
      .smult(parent.absScale())

      // Add parent's position
      .add(parent.absPosition())

    return position
  }

  /**
   * The absolute world rotation of this component.
   * @return {Number}
   */
  absRotation() {
    // Trivial case
    if (!this.parent) return this.rotation

    // This + parent
    let r = this.rotation + this.parent.absRotation()

    return r % (Math.PI * 2)
  }

  /**
   * The absolute world scale of this component.
   * @return {Number}
   */
  absScale() {
    // Trivial case
    if (!this.parent) {
      return this.scale
    }

    // This + parent
    return this.scale * this.parent.absScale()
  }
}
