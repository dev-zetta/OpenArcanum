//@flow
import Actor from './Actor'
import type GameWorld from '../../GameWorld'
import type Entity from '../Entity'
import Utils from '../../misc/Utils'
import Action from './Action'
import Actions from './actions'
import * as Actors from './actors'

export default class System {
  world: GameWorld
  actions: Map<string, any>
  actors: Map<string, any>

  /**
   *
   * @param world
   */
  constructor(world: GameWorld) {
    this.world = world
    this.actions = new Map()
    this.actors = new Map()

    this.loadActions()
    this.loadActors()
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
  loadActors() {
    for (let key in Actors) {
      this.newActor(key)
    }
  }

  /**
   *
   * @param type
   * @returns {Actor}
   */
  getActor(type: string): Actor {
    return this.newActor(type)
  }

  /**
   *
   * @param type
   * @returns {*}
   */
  newActor(type: string): Actor {
    if (!type) {
      let actor = new Actor(this)

      return actor
    }

    let actor = this.actors.get(type)

    if (actor) {
      return actor
    }

    let actorClass = Actors[type]

    actor = new actorClass(this)

    let data = Actors[type]
    if (!data) {
      Utils.logError(`No data for actor: ${type}`)
      return actor
    }

    let scheme = actor.scheme

    this.loadActions(scheme)

    this.actors.set(type, actor)
    return actor
  }

  /**
   *
   * @param scheme
   * @returns {*}
   */
  loadActions(scheme: Object): Object {

    if (!scheme) {
      return
    }



    let actions = new Map()
    let actionCount = 0
    for (let actionName in scheme.actions) {
      let action = Actions[actionName]

      if (!action) {
        Utils.logError(`Unknown action: ${key}`)
        continue
      }

      let actionScheme = scheme.actions[actionName]
      actionScheme.action = action.Action
      actionScheme.rules = action.Rules
      this.loadActions(actionScheme)

      actions.set(actionName, actionScheme)
      actionCount++
    }

    scheme.actions = actions
    scheme.totalActions = actionCount
    return scheme
  }

  /**
   *
   * @param entity
   * @param elapsed
   */
  updateEntity(entity: Entity, elapsed: number) {
    let actor = this.getActor(entity.base.type)

    actor.updateEntity(entity, elapsed)
  }


}
