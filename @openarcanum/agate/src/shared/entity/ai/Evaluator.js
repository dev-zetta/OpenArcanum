// @flow
// https://www.npmjs.com/package/utility-ai

import type System from './System'
import Action from './Action'
import type GameWorld from '../../GameWorld'

export default class Evaluator {
  system: System
  actions: Map<string, Action>

  constructor(system: System) {
    this.system = system
    this.actions = new Map()
    this._print_debug = false
  }

  get world(): GameWorld {
    return this.system.world
  }

  addAction(name: string, actionClass: Class<Action>) {
    if (!name) {
      throw Error(`Evaluator#addAction: Missing name`)
    }
    if (!actionClass) {
      throw Error(`Evaluator#addAction: Missing class`)
    }

    //const action = new actionClass(name, this)
    this.actions.set(name, actionClass)
  }

  /**
   *
   * @param name
   * @returns {Action<>}
   */
  getAction(name: string): Class<Action> {
    return this.actions.get(name)
  }

  /**
   * Evaluates the AI with given data
   * @param data
   */
  process(data: Object) {
    // data = Object.assign(
    //   {
    //     evaluator: this
    //   },
    //   data
    // )

    // lll(this.actions)

    let result = { score: 0, action: null }
    for (let [name, action] of this.actions) {
      let score = this.evaluateAction(action, data)

      if (!result || score >= result.score) {
        result.score = score
        result.action = action
        result.context = data
        result.name = name
      }
    }

    return result
  }

  validateScore(score): number {
    if (!isNaN(score) && typeof score === `number`) {
      return score
    }
    return Action.NoScore
  }

  evaluateAction(action: Action, data: Object) {
     this.log(`Evaluate Action: `, this.name)
    // if (!this.condition(data)) {
    //   this.log(`Condition not fulfilled`)
    //   return Action.Impossible
    // }

    let totalScore = 0
    let scorers = action.Scorers

    for (let name in scorers) {
      const method = scorers[name]

      let score = this.validateScore(method.call(action, data))

      if (score === Action.Impossible) {
        score = 0
        break
      }

      totalScore += score
    }

    this.log(`Final Score: `, totalScore)
    return totalScore
  }

  log(...msg) {
    if (!this._print_debug) return
    lle(...msg)
  }
}
