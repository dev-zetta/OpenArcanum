import { failure as error, position, samePosition as same, near, type AuthorityEntity, type AuthorityMap, type DoorEntity, type ContainerEntity, type Position, type PendingUse, type PreparedUse, type UseResult, type Outcome, type Failure } from './AuthorityTypes'
import Location from '../../shared/Location'
import { prepareOwnWrites } from './InventoryOwnership'

const HIDDEN_FLAGS = ['DontDraw', 'Off', 'Destroyed', 'Inventory']
const DIRECTIONS = ['North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest']
const SUPPORTED_FLAGS = new Set(['Locked', 'NeverLocked', 'AlwaysLocked', 'LockedDay', 'LockedNight',
  'Jammed', 'MagicallyHeld', 'Busted', 'Sticky'])
const flagsOf = (component: { flags?: Iterable<string> } | undefined) => [...(component?.flags || [])]

/**
 * A deliberately narrow, instance-owned door state. Converted Flags can be
 * inherited by reference from a prototype; opening never edits those objects.
 *
 * Original lock precedence and frame semantics were checked against:
 * https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/object.c
 * object_locked_get (0x441D40): NeverLocked overrides Locked.
 * https://github.com/alexbatalov/arcanum-ce/blob/a7ff41b300ef712f0e7d088183a3d08957110cdd/src/game/portal.c
 * portal_is_open / portal_open (0x4F08C0 / 0x4F0950): frame 0 is closed;
 * rotations 0/6 terminate at frame 6, rotations 2/4 at frame 3. The converter
 * records rotation as Visual.current.side and frame as current.stage (omits 0).
 * Key authorization follows arcanum-ce ai_attempt_open_portal: a matching key
 * permits opening without clearing Locked or consuming the key. Imported
 * script attachments were discarded by the historical converter; key opening
 * therefore requires an explicit authored keyUseSupported marker. Scripts,
 * timed locks, magic, jams and damage remain outside this slice.
 */
interface DoorState { id: string; entity: DoorEntity; open: boolean; openFrame: number; closedFrame: number; artSupported: boolean; originalFlags: string[]; keyId: number; keyUseMarker?: boolean; initialOpen: boolean }
interface DoorPolicy { locked: boolean; code?: string; message?: string }
export default class DoorInteractions {
  declare map: AuthorityMap
  declare canUseKey: (actor: AuthorityEntity, keyId: number) => boolean
  declare canEverUseKey: (keyId: number) => boolean
  declare states: Map<string, DoorState>
  constructor(map: AuthorityMap, { canUseKey = () => false, canEverUseKey = () => false }: { canUseKey?: (actor: AuthorityEntity, keyId: number) => boolean; canEverUseKey?: (keyId: number) => boolean } = {}) {
    this.map = map
    this.canUseKey = canUseKey
    this.canEverUseKey = canEverUseKey
    this.states = new Map()
    for (const entity of map.entityManager.entities.values()) {
      if (!this.isDoor(entity) || !entity.sourcePath) continue
      const visual = entity.visual.getCurrent()
      const side = visual.side ?? 0
      const rotation = Number.isInteger(side) && side >= 0 && side <= 7 ? side - (side % 2) : -1
      const openFrame = rotation === 0 || rotation === 6 ? 6 : 3
      const stage = visual.stage ?? 0
      const frame = typeof stage === 'string' ? DIRECTIONS.indexOf(stage) : stage
      const artSupported = [0, 2, 4, 6].includes(rotation) && Number.isInteger(frame) && frame >= 0 && frame <= 6
      const state: DoorState = { initialOpen: artSupported && frame !== 0, id: entity.sourcePath, entity, open: artSupported && frame !== 0,
        openFrame, closedFrame: 0, artSupported, originalFlags: flagsOf(entity.portal),
        keyId: entity.portal.keyID, keyUseMarker: entity.portal.keyUseSupported }
      state.initialOpen = state.open
      this.states.set(state.id, state)
      // This is an own property of the entity, never a component/prototype flag.
      if (artSupported) entity.portalOpen = state.open
    }
  }

  isDoor(entity: AuthorityEntity): entity is DoorEntity {
    return !!(entity.map === this.map && entity.base?.type === 'Portal' && entity.portal &&
      entity.visual?.getCurrent()?.category === 'Door' &&
      !entity.base.flags.hasAny(HIDDEN_FLAGS))
  }

  present(state: DoorState) {
    return this.map.entityManager.entities.get(state.entity.id) === state.entity &&
      state.entity.sourcePath === state.id && this.isDoor(state.entity)
  }

  policy(state: DoorState): DoorPolicy {
    const flags = new Set(flagsOf(state.entity.portal))
    // Busted is unlocked in the original, but its damage/art rules are outside
    // this checkpoint. Never infer that a damaged door can be normally toggled.
    const locked = !flags.has('NeverLocked') && !flags.has('Busted') && flags.has('Locked')
    if (state.entity.portal.keyID !== state.keyId || state.entity.portal.keyUseSupported !== state.keyUseMarker) {
      return { locked, ...error('UNSUPPORTED_DOOR', 'Door key authorization metadata changed') }
    }
    if (!state.artSupported) return { locked, ...error('UNSUPPORTED_DOOR', 'Door artwork or initial frame is not supported') }
    if ([...flags].some(flag => !SUPPORTED_FLAGS.has(flag))) {
      return { locked, ...error('UNSUPPORTED_DOOR', 'Door has unrecognized portal flags') }
    }
    const unsupported = ['Jammed', 'MagicallyHeld', 'Busted', 'Sticky'].find(flag => flags.has(flag))
    if (unsupported) return { locked, ...error('UNSUPPORTED_DOOR', `Door requires unsupported ${unsupported} behavior`) }
    if (!flags.has('NeverLocked') && (flags.has('LockedDay') || flags.has('LockedNight'))) {
      return { locked, ...error('UNSUPPORTED_DOOR', 'Timed door locks require authoritative world time') }
    }
    if (flags.has('AlwaysLocked')) {
      return { locked, ...error('UNSUPPORTED_DOOR', 'AlwaysLocked directional access is not implemented') }
    }
    if (locked && state.keyUseMarker !== true) {
      return { locked, ...error('LOCKED', 'Door is locked; its original scripts and key behavior are not supported') }
    }
    return { locked }
  }

  snapshots() {
    return [...this.states.values()].filter(state => this.present(state))
      .sort((a, b) => a.id.localeCompare(b.id)).map(state => {
        const policy = this.policy(state)
        return { id: state.id, kind: 'door', label: 'Door', location: position(state.entity),
          open: state.open, locked: policy.locked, usable: !policy.code,
          ...(policy.code ? { reason: policy.message } : {}),
          ...(state.artSupported ? { closedFrame: state.closedFrame, openFrame: state.openFrame } : {}) }
      })
  }

  checkpointStates() {
    return [...this.states.values()].filter(state => this.present(state))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(state => ({ id: state.id, open: state.open }))
  }

  validateCheckpoint(records: unknown): Outcome<{ candidate: Map<string, boolean> }> {
    if (!Array.isArray(records)) return error('CHECKPOINT_INVALID', 'Checkpoint door state is invalid')
    const present = [...this.states.values()].filter(state => this.present(state))
    if (records.length !== present.length) return error('CHECKPOINT_INVALID', 'Checkpoint door set does not match this map')
    const candidate = new Map()
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record) ||
          Object.keys(record).length !== 2 || !Object.hasOwn(record, 'id') || !Object.hasOwn(record, 'open') ||
          typeof record.id !== 'string' || typeof record.open !== 'boolean' || candidate.has(record.id)) {
        return error('CHECKPOINT_INVALID', 'Checkpoint door state is invalid or duplicated')
      }
      const state = this.states.get(record.id)
      if (!state || !this.present(state)) return error('CHECKPOINT_INVALID', 'Checkpoint door set does not match this map')
      // Unimplemented lock/art/damage behavior cannot be bypassed through an
      // edited checkpoint. Such doors retain their imported initial state.
      const policy = this.policy(state)
      const supported = !policy.code && (!policy.locked ||
        (state.keyUseMarker === true && this.canEverUseKey(state.keyId)))
      if ((!state.artSupported || !supported) && record.open !== state.initialOpen) {
        return error('CHECKPOINT_INVALID', 'Checkpoint changes a door whose behavior is not implemented')
      }
      candidate.set(record.id, record.open)
    }
    return { candidate }
  }

  applyCheckpoint(candidate: Map<string, boolean>) {
    // The authority validates the complete candidate before this synchronous
    // commit. Never replace or mutate shared converted component flags.
    for (const [id, open] of candidate) {
      const state = this.states.get(id)!
      state.open = open
      if (state.artSupported) state.entity.portalOpen = open
    }
  }

  prepare(targetId: string, actor: AuthorityEntity): Outcome<PreparedUse> {
    const state = this.states.get(targetId)
    if (!state || !this.present(state)) return error('UNKNOWN_TARGET', 'No supported visible door has that converted entry id')
    const policy = this.policy(state)
    if (policy.code) return error(policy.code, policy.message!)
    if (policy.locked && !state.open && !this.canUseKey(actor, state.keyId)) {
      return error('LOCKED', 'Door is locked; hold a matching supported key to open it')
    }
    const location = position(state.entity), origin = position(actor)
    let path: Position[] | undefined
    if (Math.abs(origin[0] - location[0]) + Math.abs(origin[1] - location[1]) <= 1) {
      path = [origin]
    } else {
      // Fixed candidate order resolves equal-length approaches deterministically.
      const candidates = [[location[0] - 1, location[1]], [location[0], location[1] - 1],
        [location[0], location[1] + 1], [location[0] + 1, location[1]]]
      for (const candidate of candidates) {
        const route = this.map.pathFind.findPath(actor.base.location, new Location(candidate as Position))
          .map((point): Position => [point.x, point.y])
        if (route.length && (!path || route.length < path.length)) path = route
      }
    }
    if (!path) return error('NO_PATH', 'No walkable path reaches a cardinal neighbor of the door')
    return { path, pending: { targetId, entity: state.entity, location, expectedOpen: state.open } }
  }

  apply(pending: PendingUse, actor: AuthorityEntity): Outcome<UseResult> {
    const state = this.states.get(pending.targetId)
    if (!state || !this.present(state) || state.entity !== pending.entity ||
        !same(position(state.entity), pending.location) || state.open !== pending.expectedOpen) {
      return error('TARGET_CHANGED', 'Door changed or disappeared during the approach')
    }
    const policy = this.policy(state)
    if (policy.code) return error(policy.code, policy.message!)
    if (policy.locked && !state.open && !this.canUseKey(actor, state.keyId)) {
      return error('LOCKED', 'Door is locked; hold a matching supported key to open it')
    }
    const origin = position(actor)
    if (Math.abs(origin[0] - pending.location[0]) + Math.abs(origin[1] - pending.location[1]) > 1) {
      return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the door')
    }
    if (state.open) {
      // Prevent closing through any live world object, including the controlled
      // actor. Tile terrain/walls stay owned by GameMap's collision policy.
      const occupied = [...this.map.entityManager.entities.values()].some(entity =>
        entity !== state.entity && entity.map === this.map && entity.base &&
        !entity.base.flags.hasAny(['Off', 'Destroyed', 'Inventory', 'NoBlock']) &&
        ['Pc', 'Npc', 'Scenery', 'Container', 'Portal'].includes(entity.base.type) &&
        same(position(entity), pending.location))
      if (occupied) return error('OCCUPIED', 'Cannot close a door while its tile is occupied')
    }
    const open = !state.open
    try {
      prepareOwnWrites([[state, 'open', open], [state.entity, 'portalOpen', open]]).apply()
    } catch { return error('UNSUPPORTED_DOOR', 'Door state cannot be changed safely') }
    return { result: { targetId: state.id, open: state.open } }
  }

  clear() { this.states.clear() }
}
