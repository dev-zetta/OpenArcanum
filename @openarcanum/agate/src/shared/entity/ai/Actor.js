// @flow
// https://www.npmjs.com/package/utility-ai

import type System from './System'
import Action from './Action'
import Math from '../../misc/Math'
import type GameWorld from '../../GameWorld'
import Utils from '../../misc/Utils'

export default class Actor {
  system: System
  scheme: Object
  actions: Map<string, Action>

  /**
   *
   * @param system
   */
  constructor(system: System) {
    this.system = system
    this.actions = new Map()
    this._print_debug = false
    this.actions = new Map()

    this.loadData()
  }

  /**
   *
   */
  loadData() {
    // let
    // for (let actionName in this.actions) {
    //
    //
    //
    //
    //
    // }
  }

  /**
   *
   * @returns {GameWorld|*}
   */
  get world(): GameWorld {
    return this.system.world
  }

  // addAction(name: string, actionClass: Class<Action>) {
  //   if (!name) {
  //     throw Error(`Evaluator#addAction: Missing name`)
  //   }
  //   if (!actionClass) {
  //     throw Error(`Evaluator#addAction: Missing class`)
  //   }
  //
  //   //const action = new actionClass(name, this)
  //   this.actions.set(name, actionClass)
  // }

  /**
   *
   * @param name
   * @returns {Action<>}
   */
  getSchemeNode(name: string): Object {
    return this.scheme.get(name)
  }

  /**
   *
   * @param entity
   * @param elapsed
   * @returns {boolean}
   */
  updateEntity(entity, elapsed) {
    let context = {
      entity
    }

    let { aiState } = entity.critter

    return this.updateScheme(this.scheme, aiState, context, elapsed)
  }

  /**
   *
   * @param scheme
   * @param node
   * @param context
   * @param elapsed
   * @returns {boolean}
   */
  updateScheme(scheme, node, context, elapsed) {
    let runningActions = 0
    let evaluation = this.decideBestAction(scheme, context)

    for (let [name, action] of node.actions) {
      if (action.finished) {
        lle(`Removing action`, name)
        node.removeAction(action)
      } else {
        let updated = action.update(elapsed)

        if (updated) {
          runningActions++
        }

        if (evaluation) {
          if (action.name === evaluation.name) {
            if (!updated || !action.finished) {
              //evaluation.score = Action.Impossible
              //debugger
            }
          }

          if (evaluation.score > action.score) {
            lle(`Forcefully stopping action`, action.name, evaluation.name)
            action.stop()
            updated = false
          }
        }
      }
    }

    //if (evaluation) lle(`evaluation`, evaluation)

    let hasAction = evaluation && evaluation.score !== Action.Impossible
    if (runningActions === 0 && hasAction) {
      // Call AI action

      //let action = this.newAction(evaluation.action, evaluation.context)

      let { score, action: scheme } = evaluation
      let action = new scheme.action(this, scheme, context, score)

      //lle(evaluation)
      //this.startAction(action, context)
      node.addAction(action)
      action.start(context)

      return true
    } else {
      if (runningActions > 0) {
        return true
      }

      if (!scheme.totalActions) {
        return true
      }
    }

    return false
  }

  /**
   *`
   * @param actionClass
   * @param context
   */
  // newAction(actionClass: string | Class<Action>, context: Object): Action {
  //   let { entity } = context
  //
  //   let actor = this.getActor(entity.base.type)
  //   if (Utils.isString(actionClass)) {
  //     actionClass = actor.getAction(actionClass)
  //   }
  //
  //   if (!actionClass) {
  //     lll(`!Action not found`, name)
  //     return null
  //   }
  //
  //   //lll('new action', actionClass)
  //   let action = new actionClass(actor, context)
  //   return action
  // }

  /**
   *
   * @param action
   * @param context
   */
  // startAction(action: Action, context: Object) {
  //   let { entity } = context
  //   let { critter } = entity
  //
  //   critter.aiState.addAction(action)
  //   action.start(context)
  // }

  // updateAction(action: Action, elapsed: number): boolean {
  //   if (action.finished) {
  //     this.actions.delete(action.name)
  //
  //     return true
  //   }
  //
  //   let updated = action.update(elapsed)
  //
  //   if (!updated) {
  //     //action.stop()
  //   }
  //
  //   return updated
  // }

  /**
   *
   * @param scheme
   * @param context
   * @returns {*}
   */
  decideBestAction(scheme, context) {
    let actions = []
    for (let [actionName, action] of scheme.actions) {
      let score = this.evaluateScheme(action, context)

      if (score !== Action.Impossible) {
        if (action.priority > 0.0) {
          score *= action.priority
        }

        actions.push({
          score,
          action,
          context,
          name: actionName
        })
      }
    }

    let result = null
    if (actions.length > 1) {
      actions.sort((a, b) => b.score - a.score)

      let index = 0
      for (let i = 0; i < actions.length - 1; i++) {
        let action = actions[i]
        let action2 = actions[i + 1]
        if (action.score !== action2.score) {
          index = i
          break
        }
      }

      index = Math.randomInt(0, index)
      result = actions[index]
    } else {
      if (actions.length !== 0) {
        result = actions[0]
      }
    }

    //if (actions.length)
    //lle(actions)
    return result
  }

  /**
   *
   * @param scheme
   * @param context
   * @returns {*}
   */
  evaluateScheme(scheme: Object, context: Object): Number {
    // if (!this.condition(data)) {
    //   this.log(`Condition not fulfilled`)
    //   return Action.Impossible
    // }

    let totalScore = null
    let scorers = scheme.rules

    for (let name in scorers) {
      const method = scorers[name]
      let score = method.call(scheme, context)

      if (isNaN(score) || score <= Action.NoScore) {
        totalScore = Action.Impossible
        break
      }

      if (totalScore === null) {
        totalScore = score
      } else {
        totalScore *= score
      }
    }

    //lle(`Evaluate Action: `, scheme.action, totalScore)

    // this.log(`Final Score: `, totalScore)
    return totalScore
  }

  /**
   *
   * @param msg
   */
  log(...msg) {
    if (!this._print_debug) return
    lle(...msg)
  }
}
