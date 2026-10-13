import type Entity from '../Entity'
import type Critter from '../components/Critter'
import type Location from '../../Location'
import type Actor from './Actor'
import type Action from './Action'

export type AiEntity = Entity & { critter: Critter }
export interface AiContext {
  entity: AiEntity
  targetEntity?: AiEntity
  target?: { location: Location; nextTo?: boolean }
  distanceToTarget?: number
  minDistance?: number
}
export interface AiScheme {
  actions?: Record<string, AiScheme> | Map<string, AiScheme>
  priority?: number
  totalActions?: number
  action?: new(actor: Actor, scheme: AiScheme, context: AiContext, score: number) => Action
  rules?: Record<string, (context: AiContext) => number | undefined>
}
export interface ActionNode { actions: Map<string, Action>; addAction(action: Action): void; removeAction(action: Action): void }
export interface ActionCallbacks {
  findPath?(this: Action): boolean
  onStart?(this: Action): void
  onStop?(this: Action): void
  onUpdate?(this: Action, elapsed: number): boolean | void
  onChildStarted?(this: Action, action: Action): void
  onChildStopped?(this: Action, action: Action): void
}
export function isAiEntity(entity: Entity): entity is AiEntity { return !!entity.critter }
