import Component from './Component'

export default class Scenery extends Component {
  declare respawnDelay: number


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
