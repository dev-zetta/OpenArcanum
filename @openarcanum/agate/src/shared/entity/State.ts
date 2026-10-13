import type Entity from './Entity'
export default class State {
  declare targetEntity?: Entity
  declare nearbyEntities?: Entity[]
}
