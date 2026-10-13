// @flow

import Component from './Component'

export default class Item extends Component {
  weight: number
  magicWeightAdj: number
  worth: number
  manaStore: number
  invLocation: number
  parent: string // Canonical converted source path recovered from the original MOB.
  magicTechComplexity: number
  discipline: string
  descriptionUnknown: number // id
  descriptionEffects: number // id
  spellManaStore: number
  aiAction: number // ?

  /**
   *
   */
  constructor() {
    super(...arguments)
  }

  init(params) {
    super.init(params)
  }
}
