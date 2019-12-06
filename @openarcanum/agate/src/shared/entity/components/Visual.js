// @flow
import Component from './Component'
import Flags from '../../Flags'

export type VisualClass = {}

export type VisualRender = {
  alpha: number,
  color: string,
  scale: string,
  flags: Flags
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

    this.render = { flags: new Flags() }
    this.classes = { current: {} }
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

  init(params) {
    super.init(params)
  }
}
