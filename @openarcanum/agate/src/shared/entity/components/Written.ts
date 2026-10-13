import Component from './Component'

export default class Written extends Component {
  declare subtype: string
  declare textStartLine: number
  declare textEndLine: number


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
