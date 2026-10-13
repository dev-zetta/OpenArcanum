import Component from './Component'

export default class Ammo extends Component {
  declare quantity: number
  declare type: string


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
