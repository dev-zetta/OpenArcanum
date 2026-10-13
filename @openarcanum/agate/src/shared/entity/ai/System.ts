import type GameWorld from '../../GameWorld'
import type Entity from '../Entity'
import type { AiScheme } from './AiTypes'
import { isAiEntity } from './AiTypes'
import Actor from './Actor'
import Utils from '../../misc/Utils'
import Actions from './actions'
import * as Actors from './actors'

export default class System {
  world: GameWorld
  actions = new Map<string, AiScheme>()
  actors = new Map<string, Actor>()
  constructor(world: GameWorld) { this.world = world; this.loadActors() }
  loadActors(): void { for (const key of Object.keys(Actors)) this.newActor(key) }
  getActor(type: string): Actor { return this.newActor(type) }
  newActor(type: string): Actor {
    if (!type) return new Actor(this)
    const cached = this.actors.get(type)
    if (cached) return cached
    const Constructor = Object.prototype.hasOwnProperty.call(Actors, type) ? Actors[type as keyof typeof Actors] : undefined
    if (!Constructor) { Utils.logError(`No data for actor: ${type}`); return new Actor(this) }
    const actor = new Constructor(this)
    this.loadActions(actor.scheme)
    this.actors.set(type, actor)
    return actor
  }
  loadActions(scheme?: AiScheme): AiScheme | undefined {
    if (!scheme || scheme.actions instanceof Map) return scheme
    const actions = new Map<string, AiScheme>()
    for (const [name, child] of Object.entries(scheme.actions || {})) {
      const module = Object.prototype.hasOwnProperty.call(Actions, name) ? Actions[name as keyof typeof Actions] : undefined
      if (!module) { Utils.logError(`Unknown action: ${name}`); continue }
      child.action = module.Action
      child.rules = module.Rules
      this.loadActions(child)
      actions.set(name, child)
    }
    scheme.actions = actions
    scheme.totalActions = actions.size
    return scheme
  }
  updateEntity(entity: Entity, elapsed: number): void { if (isAiEntity(entity)) this.getActor(entity.base.type).updateEntity(entity, elapsed) }
}
