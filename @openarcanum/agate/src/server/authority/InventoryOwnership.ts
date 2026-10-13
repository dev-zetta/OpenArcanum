import { failure as error, exactKeys, integer, validPosition, position, samePosition as same, type AuthorityEntity, type ActorEntity, type ItemEntity, type AuthorityMap, type AuthorityTile, type InventoryComponent, type InventoryEntry, type Position, type Outcome, type OwnWrite, type Transaction, type ItemComponent, type VisualComponent } from './AuthorityTypes'
import type { ContainerPolicy } from './ContainerInteractions'
import Location from '../../shared/Location'
import { carryingState, type CarryingState } from '../../shared/character/CarryWeight'

const ITEM_TYPES = new Set(['Weapon', 'Ammo', 'Armor', 'Gold', 'Food', 'Scroll', 'Key', 'KeyRing', 'Keyring', 'Written', 'Generic'])
const ITEM_LABELS: Record<string, string> = { Generic: 'Item', Written: 'Written item', KeyRing: 'Key ring', Keyring: 'Key ring' }
const MAX_ITEMS = 1024
const componentOf = (entity: AuthorityEntity): InventoryComponent | null | undefined => entity.base?.type === 'Container' ? entity.container :
  ['Pc', 'Npc'].includes(entity.base?.type) ? entity.critter : null
const entitiesOf = (map: AuthorityMap) => [...map.entityManager.entities.values()].filter(entity => entity.map === map)
const copyEntries = (entries: InventoryEntry[]) => entries.map(entry => ({ id: entry.id, slot: entry.slot }))
const hasKeyRing = (items: InventoryItem[]) => items.some(item => item.type === 'KeyRing' || item.type === 'Keyring')
const validKeyId = (value: unknown): value is number => integer(value) && value > 0 && value <= 2147483647
const effectiveInventory = (entity: AuthorityEntity) => entity.item?.groundTransferSupported === true && entity.base.type === 'Generic' &&
  typeof entity.ground === 'boolean' ? !entity.ground : entity.base.flags.has('Inventory')
const groundVisualIdentity = (entity: AuthorityEntity) => {
  const visual = entity.visual?.getCurrent()
  return visual && Object.fromEntries((['type', 'category', 'subcat', 'number', 'display', 'stage', 'frame'] as const).map(key => [key, visual[key]]))
}
const itemIdentity = (entity: ItemEntity) => JSON.stringify({ type: entity.base.type, prototypeId: entity.base.prototype,
  invLocation: entity.item.invLocation, flags: [...entity.item.flags], baseFlags: [...entity.base.flags],
  groundTransferSupported: entity.item.groundTransferSupported,
  ...(entity.item.groundTransferSupported === true ? { groundVisual: groundVisualIdentity(entity) } : {}),
  ...(entity.base.type === 'Key' ? { keyId: entity.key?.keyId } : {}),
  quantity: entity.base.type === 'Gold' ? entity.gold?.quantity : entity.base.type === 'Ammo' ? entity.ammo?.quantity : undefined })
const weightIdentity = (entity: ItemEntity) => JSON.stringify({ weight: entity.item.weight,
  magicWeightAdj: entity.item.magicWeightAdj })

// arcanum-ce item.c sub_463340 (0x463340): zero never matches, and one on
// either side is a master key/lock. This slice uses positive signed int IDs.
export const keyMatchesLock = (keyId: unknown, lockId: unknown) => validKeyId(keyId) && validKeyId(lockId) &&
  (keyId === 1 || lockId === 1 || keyId === lockId)

/** Shared reciprocal validation for container inspection and owned inventories. */
export function validateOwnership(map: AuthorityMap, owner: AuthorityEntity, code = 'UNSUPPORTED_CONTAINER'): Outcome<{ items: InventoryItem[]; signature: string }> {
  const invalid = () => error(code, 'Recovered inventory ownership is missing or inconsistent')
  const component = componentOf(owner)
  const inventory = component?.inventory
  if (!owner.sourcePath || !component || !Object.hasOwn(component, 'inventory') ||
      !Array.isArray(inventory) || inventory.length > MAX_ITEMS || component.inventorySource !== 0 ||
      !Number.isSafeInteger(component.inventoryIndex) || component.inventoryIndex !== inventory.length) return invalid()
  const entities = entitiesOf(map), bySource = new Map<string, AuthorityEntity>()
  for (const entity of entities) {
    if (!entity.sourcePath) continue
    if (bySource.has(entity.sourcePath)) return invalid()
    bySource.set(entity.sourcePath, entity)
  }
  if (bySource.get(owner.sourcePath) !== owner) return invalid()
  const ids = new Set<string>(), slots = new Set<number>(), items: InventoryItem[] = []
  for (const entry of inventory) {
    if (!exactKeys(entry, ['id', 'slot']) || typeof entry.id !== 'string' || !entry.id ||
        !integer(entry.slot) || entry.slot < 0 || ids.has(entry.id) || slots.has(entry.slot)) return invalid()
    const entity = bySource.get(entry.id)
    if (!entity?.item || !ITEM_TYPES.has(entity.base?.type) || !effectiveInventory(entity) ||
        entity.base.flags.hasAny(['Off', 'Destroyed']) || !Object.hasOwn(entity.item, 'parent') ||
        entity.item.parent !== owner.sourcePath || !Number.isSafeInteger(entity.base.prototype) || entity.base.prototype < 1) return invalid()
    const item: InventoryItem = { id: entry.id, slot: entry.slot, label: ITEM_LABELS[entity.base.type] || entity.base.type,
      type: entity.base.type, prototypeId: entity.base.prototype }
    const quantity = entity.base.type === 'Gold' ? entity.gold?.quantity : entity.base.type === 'Ammo' ? entity.ammo?.quantity : undefined
    if (entity.base.type === 'Gold' || entity.base.type === 'Ammo') {
      if (!integer(quantity) || quantity < 1) return invalid()
      item.quantity = quantity
    }
    ids.add(entry.id); slots.add(entry.slot); items.push(item)
  }
  for (const entity of entities) {
    if (entity.item?.parent === owner.sourcePath && (!entity.sourcePath || !ids.has(entity.sourcePath))) return invalid()
    if (entity === owner) continue
    const other = componentOf(entity)
    if (Array.isArray(other?.inventory) && other.inventory.some(entry => ids.has(entry?.id))) return invalid()
  }
  items.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
  return { items, signature: JSON.stringify(items) }
}

// Legacy components are proxies, and assigning an inherited array through
// their setter can modify the prototype. Define own instance fields instead;
// retain exact descriptors so a failed synchronous transaction can roll back.
export function prepareOwnWrites(values: OwnWrite[]): Transaction {
  const writes = values.map(([object, key, value]) => {
    const previous = Object.getOwnPropertyDescriptor(object, key)
    if ((previous && (!Object.hasOwn(previous, 'value') || !previous.writable || !previous.configurable)) ||
        (!previous && !Object.isExtensible(object))) throw new Error('Inventory state is not writable')
    return { object, key, value, previous }
  })
  let applied = 0
  return {
    apply() {
      try {
        for (const write of writes) {
          Object.defineProperty(write.object, write.key, { value: write.value, writable: true, configurable: true,
            enumerable: write.previous?.enumerable ?? true })
          applied++
        }
      } catch (failure) { this.rollback(); throw failure }
    },
    rollback() {
      for (let index = applied - 1; index >= 0; index--) {
        const write = writes[index]
        if (write.previous) Object.defineProperty(write.object, write.key, write.previous)
        else delete (write.object as Record<PropertyKey, unknown>)[write.key]
      }
      applied = 0
    }
  }
}

export interface InventoryItem { id: string; slot: number; label: string; type: string; prototypeId: number; quantity?: number; weight?: number }
interface OwnerRecord { entity: AuthorityEntity; component: InventoryComponent; entries: InventoryEntry[]; usableContainer: boolean; lockedKeyId?: number }
export interface ItemRecord { entity: ItemEntity; initialOwner: string | null; initialSlot: number | null; type: string; prototypeId: number; invLocation: number; initialLocation: Position | null; identity: string; weightIdentity?: string; keyComponent?: AuthorityEntity['key']; quantity?: number; movable?: boolean; groundCapable?: boolean; visualComponent?: VisualComponent; itemComponent?: ItemComponent }
export interface GroundItem { id: string; kind: string; label: string; type: string; prototypeId: number; location: Position }
export interface ActorInventory { ownerId: string; items: InventoryItem[]; carrying?: CarryingState }
export interface ItemResult { kind: string; itemId?: string | null; itemIds?: string[]; targetId?: string; items?: InventoryItem[]; inventory?: ActorInventory; ground?: GroundItem }
interface OwnershipOptions { canTakeFrom?: (entity: AuthorityEntity) => boolean; containerPolicy?: (entity: AuthorityEntity) => ContainerPolicy; canAccessContainer?: (entity: AuthorityEntity, actor: AuthorityEntity) => ContainerPolicy; getCarryCapacity?: () => number | null }
type Placement = [ItemRecord, Position, boolean]
/** Immutable content universe plus whole Generic and standalone Key transfers. */
export default class InventoryOwnership {
  declare map: AuthorityMap
  declare actor: ActorEntity
  declare containerPolicy: (entity: AuthorityEntity) => ContainerPolicy
  declare canTakeFrom: (entity: AuthorityEntity) => boolean
  declare canAccessContainer: (entity: AuthorityEntity, actor: AuthorityEntity) => ContainerPolicy
  declare owners: Map<string, OwnerRecord>
  declare items: Map<string, ItemRecord>
  declare invalidBaseline: boolean
  declare standaloneKeys: boolean
  declare movableCount: number
  declare getCarryCapacity: (() => number | null) | undefined
  constructor(map: AuthorityMap, actor: ActorEntity, { canTakeFrom = () => false, containerPolicy, canAccessContainer, getCarryCapacity }: OwnershipOptions = {}) {
    this.map = map; this.actor = actor
    this.getCarryCapacity = getCarryCapacity
    // Structural content eligibility never depends on current possession.
    // Actual commands separately recheck access, including a currently held key.
    this.containerPolicy = containerPolicy || (entity => canTakeFrom(entity) ? { locked: false } :
      error('UNSUPPORTED_CONTAINER', 'Container was not verified for item transfers'))
    this.canTakeFrom = entity => !this.containerPolicy(entity).code
    this.canAccessContainer = canAccessContainer || (entity => this.containerPolicy(entity))
    this.owners = new Map(); this.items = new Map(); this.invalidBaseline = false
    for (const entity of entitiesOf(map)) {
      const component = componentOf(entity)
      // Absent recovered metadata remains unknown, particularly the original
      // controlled actor. Never turn an omitted field into an empty inventory.
      if (!component || !Object.hasOwn(component, 'inventory')) continue
      const validated = validateOwnership(map, entity)
      if (validated.code !== undefined || this.owners.has(entity.sourcePath)) { this.invalidBaseline = true; continue }
      const policy = entity.base.type === 'Container' ? this.containerPolicy(entity) : null
      const usableContainer = !!policy && !policy.code && !policy.locked
      this.owners.set(entity.sourcePath, { entity, component, entries: copyEntries(component.inventory), usableContainer,
        ...(policy && !policy.code && policy.locked ? { lockedKeyId: policy.keyId } : {}) })
      for (const row of validated.items) {
        const item = entitiesOf(map).find(candidate => candidate.sourcePath === row.id) as ItemEntity
        if (this.items.has(row.id)) { this.invalidBaseline = true; continue }
        this.items.set(row.id, { entity: item, initialOwner: entity.sourcePath, initialSlot: row.slot,
          type: row.type, prototypeId: row.prototypeId, invLocation: item.item.invLocation,
          initialLocation: item.base.location ? position(item) : null,
          identity: itemIdentity(item), ...(row.type === 'Key' ? { keyComponent: item.key } : {}),
          ...(Object.hasOwn(row, 'quantity') ? { quantity: row.quantity } : {}) })
      }
    }
    // Only explicitly authored, supported parentless Generic objects join the
    // ground universe. Omitted original ownership never means an empty owner.
    for (const entity of entitiesOf(map)) {
      if (!entity.item || !Object.hasOwn(entity.item, 'parent') || entity.item.parent !== null ||
          entity.base.flags.has('Inventory') || !this.groundSupported(entity)) continue
      if (!entity.sourcePath || this.items.has(entity.sourcePath) ||
          !Number.isSafeInteger(entity.base.prototype) || entity.base.prototype < 1 ||
          !this.groundPositionValid(position(entity), entity.sourcePath)) { this.invalidBaseline = true; continue }
      this.items.set(entity.sourcePath, { entity: entity as ItemEntity, initialOwner: null, initialSlot: null, type: entity.base.type,
        prototypeId: entity.base.prototype, invLocation: entity.item.invLocation,
        initialLocation: position(entity), identity: itemIdentity(entity as ItemEntity) })
    }
    const actorKnown = actor.sourcePath === '16086.json' && this.owners.has(actor.sourcePath)
    const initialActor = actorKnown ? validateOwnership(map, actor) : null
    this.standaloneKeys = !!initialActor && initialActor.code === undefined && !hasKeyRing(initialActor.items)
    // Fixed point over INITIAL reciprocal ownership only. Initially held keys
    // and keys from unlocked supported containers can admit reviewed locked
    // containers, whose keys may admit later ones. A key behind its own lock or
    // a disconnected cycle never bootstraps itself into the movable universe.
    if (this.standaloneKeys) {
      const attainable = new Set<number>()
      const collect = (ownerId: string) => {
        for (const record of this.items.values()) {
          if (record.initialOwner === ownerId && this.keySupported(record.entity)) attainable.add(record.entity.key!.keyId)
        }
      }
      collect(actor.sourcePath)
      for (const [id, owner] of this.owners) if (owner.usableContainer) collect(id)
      let changed
      do {
        changed = false
        for (const [id, owner] of this.owners) {
          if (!owner.usableContainer && validKeyId(owner.lockedKeyId) &&
              [...attainable].some(keyId => keyMatchesLock(keyId, owner.lockedKeyId))) {
            owner.usableContainer = true; collect(id); changed = true
          }
        }
      } while (changed)
    }
    this.movableCount = 0
    for (const record of this.items.values()) {
      // Capture before the progression service is bound; enforce this separate
      // identity only when a supported live/saved capacity is supplied.
      record.weightIdentity = weightIdentity(record.entity)
      record.movable = actorKnown && (this.genericSupported(record.entity) ||
        (this.standaloneKeys && this.keySupported(record.entity))) &&
        (record.initialOwner === actor.sourcePath || this.owners.get(record.initialOwner!)?.usableContainer === true || record.initialOwner === null)
      record.groundCapable = this.groundSupported(record.entity)
      if (record.groundCapable) {
        record.visualComponent = record.entity.visual
        record.itemComponent = record.entity.item
        record.entity.ground = record.initialOwner === null
      }
      if (record.movable) this.movableCount++
    }
  }

  actorInventory(): Outcome<ActorInventory> {
    if (this.actor.sourcePath !== '16086.json' || !this.owners.has(this.actor.sourcePath)) {
      return error('INVENTORY_UNAVAILABLE', 'The controlled actor has no verified inventory ownership')
    }
    const validated = validateOwnership(this.map, this.actor, 'INVENTORY_UNAVAILABLE')
    if (validated.code !== undefined) return validated
    try {
      const capacity = this.carryCapacity()
      if (capacity === null) return { ownerId: this.actor.sourcePath, items: validated.items,
        ...(this.getCarryCapacity ? { carrying: { supported: false as const } } : {}) }
      const items = this.weightedItems(validated.items)
      return { ownerId: this.actor.sourcePath, items, carrying: carryingState(this.totalWeight(items), capacity) }
    } catch { return error('INVENTORY_UNAVAILABLE', 'Carrying weight could not be safely verified') }
  }

  private carryCapacity(): number | null {
    const capacity = this.getCarryCapacity ? this.getCarryCapacity() : null
    if (capacity !== null && (!integer(capacity) || capacity < 1)) throw new Error('Invalid carrying capacity')
    return capacity
  }

  private weightOf(id: string): number {
    const record = this.items.get(id), entity = record?.entity
    if (!record || !entity || !['Generic', 'Key'].includes(entity.base.type) ||
        record.weightIdentity !== weightIdentity(entity) || itemIdentity(entity) !== record.identity ||
        !integer(entity.item.weight) || entity.item.weight < 0 ||
        (entity.item.magicWeightAdj !== undefined && entity.item.magicWeightAdj !== 0)) {
      throw new Error('Unsupported or changed whole-item weight metadata')
    }
    return entity.item.weight
  }

  private weightedItems(rows: readonly InventoryItem[]): InventoryItem[] {
    return rows.map(row => ({ ...row, weight: this.weightOf(row.id) }))
  }

  private totalWeight(rows: readonly { weight?: number }[]): number {
    let total = 0
    for (const row of rows) {
      if (!integer(row.weight) || row.weight < 0 || !Number.isSafeInteger(total + row.weight)) throw new Error('Invalid total carrying weight')
      total += row.weight
    }
    return total
  }

  /** Enrich only private, authorized rows; public ground descriptors stay lean. */
  privateItems(rows: readonly InventoryItem[]): InventoryItem[] {
    let supported = false
    try { supported = this.carryCapacity() !== null } catch { /* An unavailable profile cannot establish a container item's effective weight. */ }
    return rows.map(({ weight: _weight, ...row }) => {
      if (supported) {
        try { return { ...row, weight: this.weightOf(row.id) } } catch { /* Container-only unknown weight stays unknown. */ }
      }
      return row
    })
  }

  private checkIncomingWeight(ids: readonly string[]): Outcome<{}> {
    try {
      const capacity = this.carryCapacity()
      if (capacity === null) return {}
      const entries = this.actor.critter.inventory
      const total = this.totalWeight([...entries.map(entry => ({ weight: this.weightOf(entry.id) })),
        ...ids.map(id => ({ weight: this.weightOf(id) }))])
      return total > capacity ? error('TOO_HEAVY', 'The complete transfer exceeds your carrying capacity.') : {}
    } catch { return error('INVENTORY_UNAVAILABLE', 'Carrying weight could not be safely verified') }
  }

  genericSupported(item: AuthorityEntity | undefined): item is ItemEntity {
    return !!(item?.base?.type === 'Generic' && item.item &&
      Number.isSafeInteger(item.item.invLocation) && item.item.invLocation >= 0 &&
      item.item.flags && [...item.item.flags].length === 0)
  }

  groundSupported(entity: AuthorityEntity): entity is ItemEntity {
    const visual = entity.visual?.getCurrent()
    return !!(this.genericSupported(entity) && entity.item.groundTransferSupported === true &&
      entity.base.flags.has('NoBlock') && !entity.base.flags.hasAny(['Off', 'Destroyed', 'DontDraw']) &&
      visual?.type === 'Item' && typeof visual.category === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(visual.category) &&
      visual.subcat === 'Base' && integer(visual.number) && visual.number >= 0 &&
      visual.display === 'Ground' && visual.stage === 'North' && visual.frame === 0 &&
      entity.base.location && validPosition(position(entity)))
  }

  groundPositionValid(location: unknown, ignoreGroundId: string | null = null): location is Position {
    if (!validPosition(location)) return false
    const [x, y] = location, tile = this.map.getTile?.(x, y)
    if (x < 0 || y < 0 || !tile?.type || tile.blocked) return false
    // Items never block movement. Allow sharing the controlled actor's tile,
    // but do not place through walls, closed doors or other solid world props.
    return !entitiesOf(this.map).some(entity => entity !== this.actor && entity.base?.location &&
      ['Wall', 'Portal', 'Pc', 'Npc', 'Scenery', 'Container'].includes(entity.base.type) &&
      same(position(entity), location) && !entity.base.flags.hasAny(['Inventory', 'Off', 'Destroyed']) &&
      (entity.base.type === 'Portal' || !entity.base.flags.has('NoBlock'))) &&
      !entitiesOf(this.map).some(entity => entity.item && entity.sourcePath !== ignoreGroundId &&
        !this.items.has(entity.sourcePath) && !effectiveInventory(entity) &&
        !entity.base.flags.hasAny(['Off', 'Destroyed', 'DontDraw']) && same(position(entity), location))
  }

  canDrop(itemId: string) {
    const record = this.items.get(itemId)
    return !!record?.movable && record.groundCapable && this.groundSupported(record.entity) &&
      record.entity.visual === record.visualComponent && record.entity.item === record.itemComponent &&
      itemIdentity(record.entity) === record.identity
  }

  groundItems(): GroundItem[] {
    return [...this.items.values()].filter(record => record.groundCapable && record.entity.ground === true)
      .sort((a, b) => a.entity.sourcePath.localeCompare(b.entity.sourcePath)).map(record => ({
        id: record.entity.sourcePath, kind: 'ground', label: 'Item', type: record.type,
        prototypeId: record.prototypeId, location: position(record.entity),
      }))
  }

  groundTarget(targetId: string): Outcome<{ record: ItemRecord }> {
    const record = this.items.get(targetId)
    if (!record?.groundCapable || record.entity.ground !== true || record.entity.item.parent !== null) {
      return error('UNKNOWN_TARGET', 'No supported ground item has that authored entry id')
    }
    try { this.validateCurrent() } catch { return error('UNSUPPORTED_ITEM', 'Ground item metadata changed') }
    return { record }
  }

  preparePlacements(placements: Placement[], values: OwnWrite[]) {
    const tiles = new Map<AuthorityTile, Map<string, Record<string, AuthorityEntity>>>()
    const list = (tile: AuthorityTile | undefined, type: string): Record<string, AuthorityEntity> => {
      if (!tile || (tile[type] !== undefined && (!tile[type] || typeof tile[type] !== 'object' || Array.isArray(tile[type])))) {
        throw new Error('Invalid item tile registration')
      }
      if (!tiles.has(tile)) tiles.set(tile, new Map())
      const types = tiles.get(tile)!
      if (!types.has(type)) types.set(type, { ...((tile[type] as Record<string, AuthorityEntity>) || {}) })
      return types.get(type)!
    }
    for (const [record, location, ground] of placements) {
      const entity = record.entity, origin = position(entity)
      const source = list(this.map.getTile(...origin), record.type)
      if (source[entity.id] !== entity) throw new Error('Item source tile registration changed')
      delete source[entity.id]
      const target = list(this.map.getTile(...location), record.type)
      if (target[entity.id] && target[entity.id] !== entity) throw new Error('Item destination tile registration changed')
      target[entity.id] = entity
      values.push([entity.base, 'location', new Location(location)], [entity, 'ground', ground])
    }
    for (const [tile, types] of tiles) for (const [type, entries] of types) values.push([tile, type, entries])
  }

  drop(itemId: string): Outcome<{ result: ItemResult }> {
    const actor = this.actorInventory()
    if (actor.code !== undefined) return actor
    if (!actor.items.some(item => item.id === itemId)) return error('UNKNOWN_ITEM', 'The item is not owned by the controlled actor')
    if (!this.canDrop(itemId)) return error('UNSUPPORTED_ITEM', 'Only authored whole Generic ground items can be dropped')
    const location = position(this.actor)
    if (!this.groundPositionValid(location)) return error('BLOCKED', 'The actor tile cannot hold a ground item')
    if (entitiesOf(this.map).some(entity => entity.item && !effectiveInventory(entity) &&
        !entity.base.flags.hasAny(['Off', 'Destroyed', 'DontDraw']) && same(position(entity), location))) {
      return error('GROUND_OCCUPIED', 'Only one ground item per tile is supported')
    }
    return this.transferGround(this.items.get(itemId)!, location, true)
  }

  pickup(targetId: string): Outcome<{ result: ItemResult }> {
    const actor = this.actorInventory()
    if (actor.code !== undefined) return actor
    const target = this.groundTarget(targetId)
    if (target.code !== undefined) return target
    if (!target.record.movable) return error('UNSUPPORTED_ITEM', 'Ground item ownership is not verified for this actor')
    if (Math.abs(position(this.actor)[0] - position(target.record.entity)[0]) +
        Math.abs(position(this.actor)[1] - position(target.record.entity)[1]) > 1) {
      return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the ground item')
    }
    if (actor.items.length >= MAX_ITEMS) return error('INVENTORY_UNAVAILABLE', 'The verified inventory cannot hold this item')
    return this.transferGround(target.record, target.record.initialLocation!, false)
  }

  transferGround(record: ItemRecord, location: Position, dropping: boolean): Outcome<{ result: ItemResult }> {
    let transaction: Transaction | undefined
    try {
      this.validateCurrent()
      const component = this.actor.critter, entries = copyEntries(component.inventory)
      const id = record.entity.sourcePath
      if (dropping) entries.splice(entries.findIndex(entry => entry.id === id), 1)
      else {
        const slots = new Set(entries.map(entry => entry.slot))
        let slot = 0
        while (slots.has(slot)) slot++
        entries.push({ id, slot }); entries.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
      }
      if (!dropping) {
        const weight = this.checkIncomingWeight([id])
        if (weight.code !== undefined) return weight
      }
      const values: OwnWrite[] = [[component, 'inventory', entries], [component, 'inventoryIndex', entries.length],
        [record.entity.item, 'parent', dropping ? null : this.actor.sourcePath]]
      this.preparePlacements([[record, location, dropping]], values)
      transaction = prepareOwnWrites(values)
      transaction.apply()
      this.validateCurrent()
      const inventory = this.actorInventory()
      if (inventory.code !== undefined) throw new Error('Invalid final inventory')
      return { result: dropping ? { kind: 'drop', itemId: id, ground: this.groundItems().find(item => item.id === id), inventory } :
        { kind: 'pickup', targetId: id, inventory } }
    } catch {
      transaction?.rollback()
      return error('INVENTORY_UNAVAILABLE', 'Verified ground ownership could not be changed safely')
    }
  }

  keySupported(item: AuthorityEntity | undefined): item is ItemEntity & { key: { keyId: number } } {
    return !!(item?.base?.type === 'Key' && item.item && item.key && validKeyId(item.key.keyId) &&
      Number.isSafeInteger(item.item.invLocation) && item.item.invLocation >= 0 &&
      item.item.flags && [...item.item.flags].length === 0)
  }

  transferSupported(item: AuthorityEntity, actorItems: InventoryItem[]) {
    return this.genericSupported(item) || (this.standaloneKeys && !hasKeyRing(actorItems) && this.keySupported(item))
  }

  hasKey(actor: AuthorityEntity, lockId: unknown) {
    if (actor !== this.actor || !validKeyId(lockId) || !this.standaloneKeys) return false
    try {
      this.validateCurrent()
      const inventory = this.actorInventory()
      if (inventory.code !== undefined || hasKeyRing(inventory.items)) return false
      return inventory.items.some(row => {
        const record = this.items.get(row.id)
        return record?.movable && this.keySupported(record.entity) && keyMatchesLock(record.entity.key!.keyId, lockId)
      })
    } catch { return false }
  }

  canEverUseKey(lockId: unknown) {
    if (!validKeyId(lockId) || !this.standaloneKeys) return false
    try {
      this.validateCurrent()
      // Keys remain in the fixed verified universe. An open door may be saved
      // after putting its key away, even though opening it again requires the
      // key to be held. Only reviewed locked sources reached by the initial
      // key closure grant keys; unreviewed or unreachable sources never do.
      return [...this.items.values()].some(record => record.movable && this.keySupported(record.entity) &&
        keyMatchesLock(record.entity.key!.keyId, lockId))
    } catch { return false }
  }

  take(container: AuthorityEntity, itemId: string) {
    return this.transfer(container, itemId, 'take')
  }

  put(container: AuthorityEntity, itemId: string) {
    return this.transfer(container, itemId, 'put')
  }

  takeAll(container: AuthorityEntity) {
    return this.transfer(container, null, 'take-all')
  }

  transfer(container: AuthorityEntity, itemId: string | null, kind: 'take' | 'put' | 'take-all'): Outcome<{ result: ItemResult }> {
    const actor = this.actorInventory()
    if (actor.code !== undefined) return actor
    const owned = validateOwnership(this.map, container)
    if (owned.code !== undefined) return owned
    if (!this.owners.get(container.sourcePath)?.usableContainer || !this.canTakeFrom(container)) {
      return error('UNSUPPORTED_CONTAINER', 'Container was not verified for item transfers')
    }
    const access = this.canAccessContainer(container, this.actor)
    if (access.code) return error(access.code, access.message!)
    const all = kind === 'take-all'
    const taking = kind !== 'put'
    const source = taking ? container : this.actor, destination = taking ? this.actor : container
    const sourceComponent = componentOf(source)!, destinationComponent = componentOf(destination)!
    const sourceItems = taking ? owned.items : actor.items
    if (all && !sourceItems.length) return error('EMPTY_CONTAINER', 'The container is empty')
    if (!all && !sourceItems.some(item => item.id === itemId)) {
      return error('UNKNOWN_ITEM', taking ? 'The item is no longer owned by this container' : 'The item is no longer owned by the controlled actor')
    }
    // The host selects the complete batch from validated, sorted ownership.
    // No client can omit an unsupported item or choose a partial batch.
    const itemIds = all ? sourceItems.map(item => item.id) : [itemId!]
    for (const id of itemIds) {
      const baseline = this.items.get(id)
      if (!baseline?.movable || !this.transferSupported(baseline.entity, actor.items)) {
        return error('UNSUPPORTED_ITEM', 'Only whole verified Generic items or standalone keys without keyring behavior can be transferred')
      }
    }
    const entries = copyEntries(destinationComponent.inventory)
    if (entries.length + itemIds.length > MAX_ITEMS) return error('INVENTORY_UNAVAILABLE', 'The verified inventory cannot hold the complete transfer')
    const occupied = new Set(entries.map(entry => entry.slot))
    let slot = 0
    for (const id of itemIds) {
      while (occupied.has(slot)) slot++
      entries.push({ id, slot }); occupied.add(slot)
    }
    entries.sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
    const selected = new Set(itemIds)
    const remaining = copyEntries(sourceComponent.inventory).filter(entry => !selected.has(entry.id))
    let transaction: Transaction | undefined
    try {
      this.validateCurrent()
      const currentActor = this.actorInventory()
      if (currentActor.code !== undefined || itemIds.some(id => !this.transferSupported(this.items.get(id)!.entity, currentActor.items))) {
        throw new Error('Item transfer support changed')
      }
      const currentAccess = this.canAccessContainer(container, this.actor)
      if (currentAccess.code) return error(currentAccess.code, currentAccess.message!)
      if (taking) {
        const weight = this.checkIncomingWeight(itemIds)
        if (weight.code !== undefined) return weight
      }
      transaction = prepareOwnWrites([
        [sourceComponent, 'inventory', remaining], [sourceComponent, 'inventoryIndex', remaining.length],
        [destinationComponent, 'inventory', entries], [destinationComponent, 'inventoryIndex', entries.length],
        ...itemIds.map((id): OwnWrite => [this.items.get(id)!.entity.item, 'parent', destination.sourcePath]),
      ])
      transaction.apply()
      const contents = validateOwnership(this.map, container)
      const inventory = this.actorInventory()
      if (contents.code !== undefined || inventory.code !== undefined) throw new Error('Transfer did not preserve reciprocal ownership')
      return { result: { kind, targetId: container.sourcePath, ...(all ? { itemIds } : { itemId }), items: contents.items, inventory } }
    } catch (_) {
      transaction?.rollback()
      return error('INVENTORY_UNAVAILABLE', 'Verified inventory state could not be changed safely')
    }
  }

  validateCurrent() {
    if (this.invalidBaseline) throw new Error('Ownership content is inconsistent')
    const checkWeight = this.carryCapacity() !== null
    const assigned = new Set<string>()
    for (const entity of entitiesOf(this.map)) {
      const component = componentOf(entity)
      if (component && Object.hasOwn(component, 'inventory') && !this.owners.has(entity.sourcePath)) {
        throw new Error('Owner content changed')
      }
    }
    for (const [id, owner] of this.owners) {
      if (owner.entity.sourcePath !== id || this.map.entityManager.entities.get(owner.entity.id) !== owner.entity ||
          componentOf(owner.entity) !== owner.component || validateOwnership(this.map, owner.entity).code) {
        throw new Error('Ownership content changed')
      }
      for (const entry of owner.component.inventory) {
        if (typeof entry.id !== 'string' || !this.items.has(entry.id) || assigned.has(entry.id)) throw new Error('Item universe changed')
        assigned.add(entry.id)
      }
    }
    const groundTiles = new Set()
    for (const [id, record] of this.items) {
      const entity = record.entity
      const quantity = record.type === 'Gold' ? entity.gold?.quantity : record.type === 'Ammo' ? entity.ammo?.quantity : undefined
      if (entity.sourcePath !== id || this.map.entityManager.entities.get(entity.id) !== entity ||
          entity.base.type !== record.type || entity.base.prototype !== record.prototypeId ||
          (record.type === 'Key' && entity.key !== record.keyComponent) ||
          (record.groundCapable && (entity.visual !== record.visualComponent || entity.item !== record.itemComponent ||
            !this.groundSupported(entity) || typeof entity.ground !== 'boolean')) ||
          entity.item.invLocation !== record.invLocation || quantity !== record.quantity || itemIdentity(entity) !== record.identity ||
          (checkWeight && weightIdentity(entity) !== record.weightIdentity)) {
        throw new Error('Item content changed')
      }
      if (record.groundCapable) {
        if (entity.ground) {
          const tileKey = position(entity).join(',')
          if (assigned.has(id) || entity.item.parent !== null || !this.groundPositionValid(position(entity)) || groundTiles.has(tileKey)) {
            throw new Error('Ground ownership changed')
          }
          assigned.add(id); groundTiles.add(tileKey)
        } else if (entity.item.parent === null || !same(position(entity), record.initialLocation!)) {
          throw new Error('Held ground item placement changed')
        }
        if ((this.map.getTile(...position(entity))?.[record.type] as Record<string, AuthorityEntity> | undefined)?.[entity.id] !== entity) {
          throw new Error('Ground item tile registration changed')
        }
      }
    }
    if (assigned.size !== this.items.size) throw new Error('Item universe changed')
  }

  checkpointStates() {
    this.validateCurrent()
    const ownership = { owners: [...this.owners].sort(([a], [b]) => a.localeCompare(b)).map(([id, state]) => ({ id,
      inventoryIndex: state.component.inventoryIndex, items: copyEntries(state.component.inventory).sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id)) })),
    items: [...this.items].sort(([a], [b]) => a.localeCompare(b)).map(([id, state]) => ({ id, parent: state.entity.item.parent,
      groundLocation: state.groundCapable && state.entity.ground ? position(state.entity) : null })) }
    // A save must never bless a reciprocal but unsupported live transition.
    // Reuse the restore validator without applying its prepared transaction.
    this.validateCheckpoint(ownership)
    this.validateCheckpointWeight(ownership, this.carryCapacity())
    return ownership
  }

  /** Validate a fully checked ownership candidate against its saved build,
   * never the live build. Preparing the ownership transaction does not apply it. */
  validateCheckpointWeight(ownership: unknown, capacity: number | null): void {
    if (capacity === null) return
    if (!integer(capacity) || capacity < 1) throw new Error('Invalid saved carrying capacity')
    this.validateCheckpoint(ownership)
    // validateCheckpoint establishes this exact structure and complete owner set.
    const candidate = ownership as { owners: { id: string; items: InventoryEntry[] }[] }
    const actor = candidate.owners.find(owner => owner.id === this.actor.sourcePath)
    if (!actor) throw new Error('Saved actor inventory is unknown')
    const weight = this.totalWeight(actor.items.map(entry => ({ weight: this.weightOf(entry.id) })))
    if (weight > capacity) throw new Error('Saved actor inventory exceeds saved carrying capacity')
  }

  validateCheckpoint(ownership: unknown): Transaction {
    this.validateCurrent()
    if (!exactKeys(ownership, ['owners', 'items']) || !Array.isArray(ownership.owners) || !Array.isArray(ownership.items) ||
        ownership.owners.length !== this.owners.size || ownership.items.length !== this.items.size) throw new Error('Invalid ownership set')
    const owners = new Map<string, InventoryEntry[]>(), items = new Map<string, string | null>(), assigned = new Map<string, string | null>()
    for (const owner of ownership.owners) {
      if (!exactKeys(owner, ['id', 'inventoryIndex', 'items']) || typeof owner.id !== 'string' || !this.owners.has(owner.id) || owners.has(owner.id) ||
          !Array.isArray(owner.items) || owner.items.length > MAX_ITEMS || !Number.isSafeInteger(owner.inventoryIndex) ||
          owner.inventoryIndex !== owner.items.length) throw new Error('Invalid owner inventory')
      const slots = new Set<number>()
      for (const entry of owner.items) {
        if (!exactKeys(entry, ['id', 'slot']) || typeof entry.id !== 'string' || !this.items.has(entry.id) || assigned.has(entry.id) ||
            !integer(entry.slot) || entry.slot < 0 || slots.has(entry.slot)) throw new Error('Invalid inventory entry')
        const original = this.items.get(entry.id)!
        if (!original.movable) {
          if (owner.id !== original.initialOwner || entry.slot !== original.initialSlot) throw new Error('Immovable item changed')
        } else {
          const source = this.owners.get(original.initialOwner!)?.entity
          const destination = this.owners.get(owner.id)!
          if ((original.initialOwner !== null && source !== this.actor && !this.canTakeFrom(source!)) ||
              (owner.id !== this.actor.sourcePath && (!destination.usableContainer || !this.canTakeFrom(destination.entity))) ||
              !(this.genericSupported(original.entity) || (this.standaloneKeys && this.keySupported(original.entity)))) {
            throw new Error('Unsupported ownership transfer')
          }
        }
        assigned.set(entry.id, owner.id); slots.add(entry.slot)
      }
      owners.set(owner.id, copyEntries(owner.items as InventoryEntry[]))
    }
    {
      // Put can leave holes in any inventory. A moved item may occupy any of
      // the first N free slots around immutable entries: earlier slots could
      // have held the other N-1 movable items before they were put elsewhere.
      // An untouched converted entry may retain its original sparse slot.
      for (const [id, entries] of owners) {
        const fixed = new Set(this.owners.get(id)!.entries.filter(entry => !this.items.get(entry.id)!.movable).map(entry => entry.slot))
        const allocated = new Set<number>()
        let slot = 0
        for (let index = 0; index < Math.min(this.movableCount, MAX_ITEMS - fixed.size); index++) {
          while (fixed.has(slot)) slot++
          allocated.add(slot++)
        }
        for (const entry of entries) {
          const original = this.items.get(entry.id)!
          if (original.movable && !(original.initialOwner === id && original.initialSlot === entry.slot) && !allocated.has(entry.slot)) {
            throw new Error('Transferred sparse slot is unreachable')
          }
        }
      }
    }
    const groundTiles = new Set<string>(), placements: Placement[] = []
    for (const item of ownership.items) {
      if (!exactKeys(item, ['id', 'parent', 'groundLocation']) || typeof item.id !== 'string' || !this.items.has(item.id) || items.has(item.id)) {
        throw new Error('Invalid reciprocal parent')
      }
      const record = this.items.get(item.id)!
      if (item.parent === null) {
        if (!record.groundCapable || assigned.has(item.id) || !this.groundPositionValid(item.groundLocation) ||
            (!record.movable && !(record.initialOwner === null && same(item.groundLocation, record.initialLocation!))) ||
            groundTiles.has(item.groundLocation.join(','))) throw new Error('Invalid ground placement')
        assigned.set(item.id, null); groundTiles.add(item.groundLocation.join(','))
      } else if (typeof item.parent !== 'string' || !this.owners.has(item.parent) || assigned.get(item.id) !== item.parent || item.groundLocation !== null) {
        throw new Error('Invalid reciprocal parent')
      }
      items.set(item.id, item.parent as string | null)
      if (record.groundCapable) placements.push([record, item.parent === null ? item.groundLocation as Position : record.initialLocation!, item.parent === null])
    }
    if (assigned.size !== this.items.size) throw new Error('An item disappeared')
    const values: OwnWrite[] = []
    for (const [id, entries] of owners) {
      const component = this.owners.get(id)!.component
      values.push([component, 'inventory', entries], [component, 'inventoryIndex', entries.length])
    }
    for (const [id, parent] of items) values.push([this.items.get(id)!.entity.item, 'parent', parent])
    this.preparePlacements(placements, values)
    return prepareOwnWrites(values)
  }

  clear() { this.owners.clear(); this.items.clear() }
}
