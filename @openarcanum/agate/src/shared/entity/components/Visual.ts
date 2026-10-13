
export interface VisualClass {
  type?: string
  sprite?: import('../../../client/Sprite').default | null
  iso?: { x: number; y: number; z: number }
  name?: string | number
  category?: string
  subcat?: string | number
  number?: number
  race?: string
  gender?: string
  armor?: string
  shield?: string
  weapon?: string
  animation?: string
  version?: number
  side?: number
  stage?: string | number
  frame?: number
  rotation?: number
  [key: string]: unknown
}
export interface VisualRender { alpha?: number; color?: string | number; scale?: string | number; flags: Flags }
export interface VisualLight { color?: string | number; flags?: string[]; radius?: number; [key: string]: unknown }
import Component from './Component'
import Flags from '../../Flags'

export default class Visual extends Component {
  declare classes: Record<string, VisualClass> & { current: VisualClass }
  declare render: VisualRender
  declare light: VisualLight


  constructor() {
    super()

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

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  }
}
