// @flow
import Component from './Component'

export type VisualClass = {}

export type VisualRender = {
  alpha: number,
  color: string,
  scale: string
}

export type VisualLight = {
  color: string,
  flags: string
}

export default class Visual extends Component {
  classes: Map<string, VisualClass>
  render: VisualRender
  light: VisualLight

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
