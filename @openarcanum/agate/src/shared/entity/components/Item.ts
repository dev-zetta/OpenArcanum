import Component from './Component'

export default class Item extends Component {
  declare groundTransferSupported?: boolean
  declare weight: number
  declare magicWeightAdj: number
  declare worth: number
  declare manaStore: number
  declare invLocation: number
  declare parent: string
  declare magicTechComplexity: number
  declare discipline: string
  declare descriptionUnknown: number
  declare descriptionEffects: number
  declare spellManaStore: number
  declare aiAction: number


                 // Canonical converted source path recovered from the original MOB.

                             // id
                             // id

                   // ?

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
