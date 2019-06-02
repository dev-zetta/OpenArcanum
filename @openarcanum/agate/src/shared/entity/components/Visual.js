/* global AGate */
import Core from './Core'

export default class Visual extends Core {
  constructor() {
    super(...arguments)
  }

  /**
   *
   * @returns {null}
   */
  getCurrent() {
    if (!this.classes) {
      return null
    }

    return this.classes.current
  }
}
