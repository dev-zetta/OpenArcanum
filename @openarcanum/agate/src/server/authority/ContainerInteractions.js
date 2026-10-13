import Location from '../../shared/Location'
import { validateOwnership } from './InventoryOwnership'

const HIDDEN_FLAGS = ['DontDraw', 'Off', 'Destroyed', 'Inventory']
const SUPPORTED_FLAGS = new Set(['Locked', 'NeverLocked', 'AlwaysLocked', 'LockedDay', 'LockedNight',
  'Jammed', 'MagicallyHeld', 'Busted', 'Sticky'])
const error = (code, message) => ({ code, message })
const position = entity => [entity.base.location.x, entity.base.location.y]
const same = (a, b) => a[0] === b[0] && a[1] === b[1]
const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1

/** Recovered ownership inspection and access policy; no item art state.
 * arcanum-ce ai.c ai_attempt_open_container (3830-3864) authorizes ordinary
 * locked access with a matching key without clearing Locked or consuming it.
 * SAP_UNLOCK/SAP_USE run in the original. Their historical converted metadata
 * is incomplete, so key access requires an explicitly reviewed authored marker.
 */
export default class ContainerInteractions {
  constructor(map, { canUseKey = () => false } = {}) {
    this.map = map
    this.canUseKey = canUseKey
    this.states = new Map()
    for (const entity of map.entityManager.entities.values()) {
      if (this.isContainer(entity) && entity.sourcePath) this.states.set(entity.sourcePath, {
        id: entity.sourcePath, entity, keyId: entity.container.keyId,
        keyUseMarker: entity.container.keyUseSupported,
      })
    }
  }

  isContainer(entity) {
    // Many original containers use Scenery artwork (dressers/nightstands).
    // Gameplay type, not the artwork category, determines the interaction.
    return entity.map === this.map && entity.base?.type === 'Container' && entity.container &&
      !entity.base.flags.hasAny(HIDDEN_FLAGS)
  }

  present(state) {
    return this.map.entityManager.entities.get(state.entity.id) === state.entity &&
      state.entity.sourcePath === state.id && this.isContainer(state.entity)
  }

  policy(state) {
    const flags = new Set(state.entity.container.flags || [])
    // arcanum-ce object_locked_get (0x441D40) applies the same precedence to
    // portals and containers: Busted, then NeverLocked, then timed/Locked.
    const locked = !flags.has('NeverLocked') && !flags.has('Busted') && flags.has('Locked')
    if (state.entity.container.keyId !== state.keyId || state.entity.container.keyUseSupported !== state.keyUseMarker) {
      return { locked, ...error('UNSUPPORTED_CONTAINER', 'Container key authorization metadata changed') }
    }
    if ([...flags].some(flag => !SUPPORTED_FLAGS.has(flag)) ||
        ['Jammed', 'MagicallyHeld', 'Busted', 'Sticky'].some(flag => flags.has(flag)) ||
        (!flags.has('NeverLocked') && (flags.has('LockedDay') || flags.has('LockedNight')))) {
      return { locked, ...error('UNSUPPORTED_CONTAINER', 'Container requires unsupported lock, damage or inventory spawning behavior') }
    }
    if (flags.has('AlwaysLocked')) return { locked, ...error('UNSUPPORTED_CONTAINER', 'AlwaysLocked container access is not implemented') }
    if (locked && state.keyUseMarker !== true) {
      return { locked, ...error('LOCKED', 'Container is locked; its original scripts and key behavior are not supported') }
    }
    if (state.entity.container.inventorySource !== 0) {
      return { locked, ...error('UNSUPPORTED_CONTAINER', 'Container inventory sources are not implemented') }
    }
    const ownership = this.ownership(state)
    if (ownership.code) return { locked, ...ownership }
    return { locked, ...(locked ? { keyId: state.keyId } : {}), ...ownership }
  }

  access(state, actor) {
    const policy = this.policy(state)
    if (policy.code) return policy
    if (policy.locked && !this.canUseKey(actor, state.keyId)) {
      return error('LOCKED', 'Container is locked; hold a matching supported key to access it')
    }
    return policy
  }

  ownership(state) {
    return validateOwnership(this.map, state.entity)
  }

  snapshots() {
    return [...this.states.values()].filter(state => this.present(state))
      .sort((a, b) => a.id.localeCompare(b.id)).map(state => {
        const policy = this.policy(state)
        return { id: state.id, kind: 'container', label: 'Container', location: position(state.entity),
          locked: policy.locked, usable: !policy.code, ...(policy.code ? { reason: policy.message } : {}) }
      })
  }

  prepare(targetId, actor) {
    const state = this.states.get(targetId)
    if (!state || !this.present(state)) return error('UNKNOWN_TARGET', 'No visible container has that converted entry id')
    const policy = this.access(state, actor)
    if (policy.code) return policy
    const location = position(state.entity), origin = position(actor)
    let path
    if (near(origin, location)) path = [origin]
    else {
      for (const candidate of [[location[0] - 1, location[1]], [location[0], location[1] - 1],
        [location[0], location[1] + 1], [location[0] + 1, location[1]]]) {
        const route = this.map.pathFind.findPath(actor.base.location, new Location(candidate)).map(point => [point.x, point.y])
        if (route.length && (!path || route.length < path.length)) path = route
      }
    }
    if (!path) return error('NO_PATH', 'No walkable path reaches a cardinal neighbor of the container')
    return { path, pending: { targetId, entity: state.entity, location, signature: policy.signature } }
  }

  apply(pending, actor) {
    const state = this.states.get(pending.targetId)
    if (!state || !this.present(state) || state.entity !== pending.entity || !same(position(state.entity), pending.location)) {
      return error('TARGET_CHANGED', 'Container changed or disappeared during the approach')
    }
    const policy = this.access(state, actor)
    if (policy.code) return policy
    if (policy.signature !== pending.signature) return error('TARGET_CHANGED', 'Container contents changed during the approach')
    if (!near(position(actor), pending.location)) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the container')
    return { result: { kind: 'container', targetId: state.id } }
  }

  inspect(targetId, actor) {
    const state = this.states.get(targetId)
    if (!state || !this.present(state)) return error('UNKNOWN_TARGET', 'No visible container has that converted entry id')
    const policy = this.access(state, actor)
    if (policy.code) return policy
    if (!near(position(actor), position(state.entity))) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the container')
    return { result: { kind: 'container', targetId: state.id, items: policy.items } }
  }

  clear() { this.states.clear() }
}
