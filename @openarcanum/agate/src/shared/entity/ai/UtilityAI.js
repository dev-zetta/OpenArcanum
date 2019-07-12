import Action from './Action'

export default class UtilityAi {
  constructor() {
    this._actions = []
  }

  addAction(description, callback) {
    if (!description) {
      throw Error(`UtilityAi#addAction: Missing description`)
    }
    if (!callback) {
      throw Error(`UtilityAi#addAction: Missing callback`)
    }

    const action = new Action(description, callback)
    this._actions.push(action)
  }

  evaluate(data, debug = false) {

    let result = {score: 0, action: null}
    for (let action of this._actions) {
      let score = action.evaluate(data, debug)

      if (!result || score >= result.score) {
        result.score = score
        result.action = action.description
      }
    }

    return result
  }
}
