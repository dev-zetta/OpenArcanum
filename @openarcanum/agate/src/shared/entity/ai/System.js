//@flow
import Evaluator from './Evaluator'
import Evaluators from './Evaluators'
import type GameWorld from '../../GameWorld'
import type Entity from '../Entity'
import Utils from '../../misc/Utils'
import Action from './Action'

export default class System {
  world: GameWorld
  actions: Map<string, any>
  evaluators: Map<string, any>

  /**
   *
   * @param world
   */
  constructor(world: GameWorld) {
    this.world = world
    this.actions = new Map()
    this.evaluators = new Map()

    this.loadActions()
    this.loadEvaluators()
  }

  /**
   *
   */
  loadActions() {
    /*Utils.loadScripts(`shared/entity/ai/actions`, (name, script) => {
      let action = script.action

      let object = {
        scores: {}
      }

      for (let key in action) {
        let property = action[key]

        if (Utils.isFunction(property)) {
          object.scores[key] = property
        }
      }

      this.actions.set(name, object)
    })*/
  }

  /**
   *
   */
  loadEvaluators() {
    for (let key in Evaluators) {
      this.newEvaluator(key)
    }
  }

  /**
   *
   * @param type
   * @returns {Evaluator}
   */
  getEvaluator(type: string): Evaluator {
    return this.newEvaluator(type)
  }

  /**
   *
   * @param type
   * @returns {*}
   */
  newEvaluator(type: string): Evaluator {
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
      Utils.logError(`No data for evaluator: ${type}`)
      return evaluator
    }

    for (let key in data.actions) {
      let actionClass = data.actions[key] //this.actions.get(key)
      if (!actionClass) {
        Utils.logError(`Unknown action: ${key}`)
        continue
      }

      let options = {}
      evaluator.addAction(key, actionClass, options)
    }

    this.evaluators.set(type, evaluator)
    return evaluator
  }

  updateEntity(entity: Entity, elapsed: number) {
    let evaluator = this.getEvaluator(entity.base.type)

    let context = {
      entity
    }
    let evaluation = evaluator.process(context)



    let { aiState } = entity.critter
    for (let [name, action] of aiState.actions) {
      if (action.name === evaluation.name) {

        if (!action.finished) {
          evaluation.score = Action.Impossible
        }
      }

      this.updateAction(action, elapsed)
    }

    if (evaluation.score > 0 && evaluation.action) {
      // Call AI action
      let action = this.newAction(evaluation.action, evaluation.context)
      this.startAction(action, evaluation.context)
    }


  }

  /**
   *
   * @param actionClass
   * @param context
   */
  newAction(actionClass: string|Class<Action>, context: Object): Action {

    let { entity } = context


    let evaluator = this.getEvaluator(entity.base.type)
    if (Utils.isString(actionClass )) {
      actionClass = evaluator.getAction(actionClass)
    }


    if (!actionClass) {
      lll(`!Action not found`, name)
      return null
    }

    lll('new action', actionClass)
    let action = new actionClass(evaluator, context)
    return action
  }

  /**
   *
   * @param action
   * @param context
   */
  startAction(action: Action, context: Object) {
    let { entity } = context
    let { critter } = entity

    //ll(`action`, action, entity.id)
    critter.aiState.addAction(action)
    action.start(context)

  }

  /**
   *
   * @param action
   * @param elapsed
   * @returns {boolean}
   */
  updateAction(action: Action, elapsed: number): boolean {
    if (action.finished) {
      this.actions.delete(action.name)

      return true
    }

    let updated = action.update(elapsed)

    if (!updated) {
      //action.stop()
    }

    return updated
  }
}
