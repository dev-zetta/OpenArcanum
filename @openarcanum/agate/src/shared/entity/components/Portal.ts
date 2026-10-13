import Component from './Component'

export default class Portal extends Component {
  declare lockDifficulty: number
  declare keyID: string
  declare notifyNPC: string


  /**
   *
   */
  constructor() {
    super()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)
  }
}
