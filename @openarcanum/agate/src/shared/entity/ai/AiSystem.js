/* global AGate */
import Evaluator from './Evaluator'

let Evaluators = {
  npc: {
    actions: {
      MoveToWaypoint: {},
      AttackNearby: {}
    }
  }
}

export default class AiSystem {
  constructor(map) {
    this.map = map
    this.actions = new Map()
    this.evaluators = new Map()

    this.loadActions()
    this.loadEvaluators()
  }

  loadActions() {
    AGate.Utils.loadScripts(`shared/entity/ai/actions`, (name, script) => {
      let action = script.action

      let object = {
        scores: {}
      }

      for (let key in action) {
        let property = action[key]

        if (AGate.Utils.isFunction(property)) {
          object.scores[key] = property
        }
      }

      this.actions.set(name, object)
    })
  }

  loadEvaluators() {
    for (let key in Evaluators) {
      this.newEvaluator(key)
    }
  }

  getEvaluator(type) {
    return this.newEvaluator(type)
  }

  newEvaluator(type) {
    if (!type) {
      let evaluator = new Evaluator(this)

      return evaluator
    }

    let evaluator = this.evaluators.get(type)

    if (evaluator) {
      return evaluator
    }

    evaluator = new Evaluator(this)

    let data = Evaluators[type]
    if (!data) {
      AGate.Utils.logError(`No data for evaluator: ${type}`)
      return evaluator
    }

    for (let key in data.actions) {
      let action = this.actions.get(key)
      if (!action) {
        AGate.Utils.logError(`Unknown action: ${key}`)
        continue
      }

      let options = data.actions[key]
      evaluator.addAction(key, options)
    }

    this.evaluators.set(type, evaluator)
    return evaluator
  }
}
