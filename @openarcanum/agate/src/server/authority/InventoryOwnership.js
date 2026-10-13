import Location from '../../shared/Location'

const ITEM_TYPES = new Set(['Weapon', 'Ammo', 'Armor', 'Gold', 'Food', 'Scroll', 'Key', 'KeyRing', 'Keyring', 'Written', 'Generic'])
const ITEM_LABELS = { Generic: 'Item', Written: 'Written item', KeyRing: 'Key ring', Keyring: 'Key ring' }
const MAX_ITEMS = 1024
const error = (code, message) => ({ code, message })
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const componentOf = entity => entity.base?.type === 'Container' ? entity.container :
  ['Pc', 'Npc'].includes(entity.base?.type) ? entity.critter : null
const entitiesOf = map => [...map.entityManager.entities.values()].filter(entity => entity.map === map)
const copyEntries = entries => entries.map(entry => ({ id: entry.id, slot: entry.slot }))
const hasKeyRing = items => items.some(item => item.type === 'KeyRing' || item.type === 'Keyring')
const validKeyId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647
const position = entity => [entity.base.location.x, entity.base.location.y]
const same = (a, b) => a[0] === b[0] && a[1] === b[1]
const validPosition = value => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger)
const effectiveInventory = entity => entity.item?.groundTransferSupported === true && entity.base.type === 'Generic' &&
  typeof entity.ground === 'boolean' ? !entity.ground : entity.base.flags.has('Inventory')
const groundVisualIdentity = entity => {
  const visual = entity.visual?.getCurrent()
  return visual && Object.fromEntries(['type', 'category', 'subcat', 'number', 'display', 'stage', 'frame'].map(key => [key, visual[key]]))
}
const itemIdentity = entity => JSON.stringify({ type: entity.base.type, prototypeId: entity.base.prototype,
  invLocation: entity.item.invLocation, flags: [...entity.item.flags], baseFlags: [...entity.base.flags],
  groundTransferSupported: entity.item.groundTransferSupported,
  ...(entity.item.groundTransferSupported === true ? { groundVisual: groundVisualIdentity(entity) } : {}),
  ...(entity.base.type === 'Key' ? { keyId: entity.key?.keyId } : {}),
  quantity: entity.base.type === 'Gold' ? entity.gold?.quantity : entity.base.type === 'Ammo' ? entity.ammo?.quantity : undefined })

// arcanum-ce item.c sub_463340 (0x463340): zero never matches, and one on
// either side is a master key/lock. This slice uses positive signed int IDs.
export const keyMatchesLock = (keyId, lockId) => validKeyId(keyId) && validKeyId(lockId) &&
  (keyId === 1 || lockId === 1 || keyId === lockId)

/** Shared reciprocal validation for container inspection and owned inventories. */
export function validateOwnership(map, owner, code = 'UNSUPPORTED_CONTAINER') {
  const invalid = () => error(code, 'Recovered inventory ownership is missing or inconsistent')
  const component = componentOf(owner)
  const inventory = component?.inventory
  if (!owner.sourcePath || !component || !Object.hasOwn(component, 'inventory') ||
      !Array.isArray(inventory) || inventory.length > MAX_ITEMS || component.inventorySource !== 0 ||
      !Number.isSafeInteger(component.inventoryIndex) || component.inventoryIndex !== inventory.length) return invalid()
  const entities = entitiesOf(map), bySource = new Map()
  for (const entity of entities) {
    if (!entity.sourcePath) continue
    if (bySource.has(entity.sourcePath)) return invalid()
    bySource.set(entity.sourcePath, entity)
  }
  if (bySource.get(owner.sourcePath) !== owner) return invalid()
  const ids = new Set(), slots = new Set(), items = []
  for (const entry of inventory) {
    if (!exactKeys(entry, ['id', 'slot']) || typeof entry.id !== 'string' || !entry.id ||
        !Number.isSafeInteger(entry.slot) || entry.slot < 0 || ids.has(entry.id) || slots.has(entry.slot)) return invalid()
    const entity = bySource.get(entry.id)
    if (!entity?.item || !ITEM_TYPES.has(entity.base?.type) || !effectiveInventory(entity) ||
        entity.base.flags.hasAny(['Off', 'Destroyed']) || !Object.hasOwn(entity.item, 'parent') ||
        entity.item.parent !== owner.sourcePath || !Number.isSafeInteger(entity.base.prototype) || entity.base.prototype < 1) return invalid()
    const item = { id: entry.id, slot: entry.slot, label: ITEM_LABELS[entity.base.type] || entity.base.type,
      type: entity.base.type, prototypeId: entity.base.prototype }
    const quantity = entity.base.type === 'Gold' ? entity.gold?.quantity : entity.base.type === 'Ammo' ? entity.ammo?.quantity : undefined
    if (entity.base.type === 'Gold' || entity.base.type === 'Ammo') {
      if (!Number.isSafeInteger(quantity) || quantity < 1) return invalid()
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
export function prepareOwnWrites(values) {
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
        else delete write.object[write.key]
      }
      applied = 0
    }
  }
}

/** Immutable content universe plus whole Generic and standalone Key transfers. */
export default class InventoryOwnership {
  constructor(map, actor, { canTakeFrom = () => false, containerPolicy, canAccessContainer } = {}) {
    this.map = map; this.actor = actor
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
      if (validated.code || this.owners.has(entity.sourcePath)) { this.invalidBaseline = true; continue }
      const policy = entity.base.type === 'Container' ? this.containerPolicy(entity) : null
      const usableContainer = !!policy && !policy.code && !policy.locked
      this.owners.set(entity.sourcePath, { entity, component, entries: copyEntries(component.inventory), usableContainer,
        ...(policy && !policy.code && policy.locked ? { lockedKeyId: policy.keyId } : {}) })
      for (const row of validated.items) {
        const item = entitiesOf(map).find(candidate => candidate.sourcePath === row.id)
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
      this.items.set(entity.sourcePath, { entity, initialOwner: null, initialSlot: null, type: entity.base.type,
        prototypeId: entity.base.prototype, invLocation: entity.item.invLocation,
        initialLocation: position(entity), identity: itemIdentity(entity) })
    }
    const actorKnown = actor.sourcePath === '16086.json' && this.owners.has(actor.sourcePath)
    const initialActor = actorKnown ? validateOwnership(map, actor) : null
    this.standaloneKeys = !!initialActor && !initialActor.code && !hasKeyRing(initialActor.items)
    // Fixed point over INITIAL reciprocal ownership only. Initially held keys
    // and keys from unlocked supported containers can admit reviewed locked
    // containers, whose keys may admit later ones. A key behind its own lock or
    // a disconnected cycle never bootstraps itself into the movable universe.
    if (this.standaloneKeys) {
      const attainable = new Set()
      const collect = ownerId => {
        for (const record of this.items.values()) {
          if (record.initialOwner === ownerId && this.keySupported(record.entity)) attainable.add(record.entity.key.keyId)
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
      record.movable = actorKnown && (this.genericSupported(record.entity) ||
        (this.standaloneKeys && this.keySupported(record.entity))) &&
        (record.initialOwner === actor.sourcePath || this.owners.get(record.initialOwner)?.usableContainer === true || record.initialOwner === null)
      record.groundCapable = this.groundSupported(record.entity)
      if (record.groundCapable) {
        record.visualComponent = record.entity.visual
        record.itemComponent = record.entity.item
        record.entity.ground = record.initialOwner === null
      }
      if (record.movable) this.movableCount++
    }
  }

  actorInventory() {
    if (this.actor.sourcePath !== '16086.json' || !this.owners.has(this.actor.sourcePath)) {
      return error('INVENTORY_UNAVAILABLE', 'The controlled actor has no verified inventory ownership')
    }
    const validated = validateOwnership(this.map, this.actor, 'INVENTORY_UNAVAILABLE')
    return validated.code ? validated : { ownerId: this.actor.sourcePath, items: validated.items }
  }

  genericSupported(item) {
    return item?.base?.type === 'Generic' && item.item &&
      Number.isSafeInteger(item.item.invLocation) && item.item.invLocation >= 0 &&
      item.item.flags && [...item.item.flags].length === 0
  }

  groundSupported(entity) {
    const visual = entity.visual?.getCurrent()
    return !!(this.genericSupported(entity) && entity.item.groundTransferSupported === true &&
      entity.base.flags.has('NoBlock') && !entity.base.flags.hasAny(['Off', 'Destroyed', 'DontDraw']) &&
      visual?.type === 'Item' && typeof visual.category === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(visual.category) &&
      visual.subcat === 'Base' && Number.isSafeInteger(visual.number) && visual.number >= 0 &&
      visual.display === 'Ground' && visual.stage === 'North' && visual.frame === 0 &&
      entity.base.location && validPosition(position(entity)))
  }

  groundPositionValid(location, ignoreGroundId = null) {
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

  canDrop(itemId) {
    const record = this.items.get(itemId)
    return !!record?.movable && record.groundCapable && this.groundSupported(record.entity) &&
      record.entity.visual === record.visualComponent && record.entity.item === record.itemComponent &&
      itemIdentity(record.entity) === record.identity
  }

  groundItems() {
    return [...this.items.values()].filter(record => record.groundCapable && record.entity.ground === true)
      .sort((a, b) => a.entity.sourcePath.localeCompare(b.entity.sourcePath)).map(record => ({
        id: record.entity.sourcePath, kind: 'ground', label: 'Item', type: record.type,
        prototypeId: record.prototypeId, location: position(record.entity),
      }))
  }

  groundTarget(targetId) {
    const record = this.items.get(targetId)
    if (!record?.groundCapable || record.entity.ground !== true || record.entity.item.parent !== null) {
      return error('UNKNOWN_TARGET', 'No supported ground item has that authored entry id')
    }
    try { this.validateCurrent() } catch { return error('UNSUPPORTED_ITEM', 'Ground item metadata changed') }
    return { record }
  }

  preparePlacements(placements, values) {
    const tiles = new Map()
    const list = (tile, type) => {
      if (!tile || (tile[type] !== undefined && (!tile[type] || typeof tile[type] !== 'object' || Array.isArray(tile[type])))) {
        throw new Error('Invalid item tile registration')
      }
      if (!tiles.has(tile)) tiles.set(tile, new Map())
      const types = tiles.get(tile)
      if (!types.has(type)) types.set(type, { ...(tile[type] || {}) })
      return types.get(type)
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

  drop(itemId) {
    const actor = this.actorInventory()
    if (actor.code) return actor
    if (!actor.items.some(item => item.id === itemId)) return error('UNKNOWN_ITEM', 'The item is not owned by the controlled actor')
    if (!this.canDrop(itemId)) return error('UNSUPPORTED_ITEM', 'Only authored whole Generic ground items can be dropped')
    const location = position(this.actor)
    if (!this.groundPositionValid(location)) return error('BLOCKED', 'The actor tile cannot hold a ground item')
    if (entitiesOf(this.map).some(entity => entity.item && !effectiveInventory(entity) &&
        !entity.base.flags.hasAny(['Off', 'Destroyed', 'DontDraw']) && same(position(entity), location))) {
      return error('GROUND_OCCUPIED', 'Only one ground item per tile is supported')
    }
    return this.transferGround(this.items.get(itemId), location, true)
  }

  pickup(targetId) {
    const actor = this.actorInventory()
    if (actor.code) return actor
    const target = this.groundTarget(targetId)
    if (target.code) return target
    if (!target.record.movable) return error('UNSUPPORTED_ITEM', 'Ground item ownership is not verified for this actor')
    if (Math.abs(position(this.actor)[0] - position(target.record.entity)[0]) +
        Math.abs(position(this.actor)[1] - position(target.record.entity)[1]) > 1) {
      return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the ground item')
    }
    if (actor.items.length >= MAX_ITEMS) return error('INVENTORY_UNAVAILABLE', 'The verified inventory cannot hold this item')
    return this.transferGround(target.record, target.record.initialLocation, false)
  }

  transferGround(record, location, dropping) {
    let transaction
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
      const values = [[component, 'inventory', entries], [component, 'inventoryIndex', entries.length],
        [record.entity.item, 'parent', dropping ? null : this.actor.sourcePath]]
      this.preparePlacements([[record, location, dropping]], values)
      transaction = prepareOwnWrites(values)
      transaction.apply()
      this.validateCurrent()
      const inventory = this.actorInventory()
      if (inventory.code) throw new Error('Invalid final inventory')
      return { result: dropping ? { kind: 'drop', itemId: id, ground: this.groundItems().find(item => item.id === id), inventory } :
        { kind: 'pickup', targetId: id, inventory } }
    } catch {
      transaction?.rollback()
      return error('INVENTORY_UNAVAILABLE', 'Verified ground ownership could not be changed safely')
    }
  }

  keySupported(item) {
    return item?.base?.type === 'Key' && item.item && item.key && validKeyId(item.key.keyId) &&
      Number.isSafeInteger(item.item.invLocation) && item.item.invLocation >= 0 &&
      item.item.flags && [...item.item.flags].length === 0
  }

  transferSupported(item, actorItems) {
    return this.genericSupported(item) || (this.standaloneKeys && !hasKeyRing(actorItems) && this.keySupported(item))
  }

  hasKey(actor, lockId) {
    if (actor !== this.actor || !validKeyId(lockId) || !this.standaloneKeys) return false
    try {
      this.validateCurrent()
      const inventory = this.actorInventory()
      if (inventory.code || hasKeyRing(inventory.items)) return false
      return inventory.items.some(row => {
        const record = this.items.get(row.id)
        return record?.movable && this.keySupported(record.entity) && keyMatchesLock(record.entity.key.keyId, lockId)
      })
    } catch { return false }
  }

  canEverUseKey(lockId) {
    if (!validKeyId(lockId) || !this.standaloneKeys) return false
    try {
      this.validateCurrent()
      // Keys remain in the fixed verified universe. An open door may be saved
      // after putting its key away, even though opening it again requires the
      // key to be held. Only reviewed locked sources reached by the initial
      // key closure grant keys; unreviewed or unreachable sources never do.
      return [...this.items.values()].some(record => record.movable && this.keySupported(record.entity) &&
        keyMatchesLock(record.entity.key.keyId, lockId))
    } catch { return false }
  }

  take(container, itemId) {
    return this.transfer(container, itemId, 'take')
  }

  put(container, itemId) {
    return this.transfer(container, itemId, 'put')
  }

  takeAll(container) {
    return this.transfer(container, null, 'take-all')
  }

  transfer(container, itemId, kind) {
    const actor = this.actorInventory()
    if (actor.code) return actor
    const owned = validateOwnership(this.map, container)
    if (owned.code) return owned
    if (!this.owners.get(container.sourcePath)?.usableContainer || !this.canTakeFrom(container)) {
      return error('UNSUPPORTED_CONTAINER', 'Container was not verified for item transfers')
    }
    const access = this.canAccessContainer(container, this.actor)
    if (access.code) return access
    const all = kind === 'take-all'
    const taking = kind !== 'put'
    const source = taking ? container : this.actor, destination = taking ? this.actor : container
    const sourceComponent = componentOf(source), destinationComponent = componentOf(destination)
    const sourceItems = taking ? owned.items : actor.items
    if (all && !sourceItems.length) return error('EMPTY_CONTAINER', 'The container is empty')
    if (!all && !sourceItems.some(item => item.id === itemId)) {
      return error('UNKNOWN_ITEM', taking ? 'The item is no longer owned by this container' : 'The item is no longer owned by the controlled actor')
    }
    // The host selects the complete batch from validated, sorted ownership.
    // No client can omit an unsupported item or choose a partial batch.
    const itemIds = all ? sourceItems.map(item => item.id) : [itemId]
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
    let transaction
    try {
      this.validateCurrent()
      const currentActor = this.actorInventory()
      if (currentActor.code || itemIds.some(id => !this.transferSupported(this.items.get(id).entity, currentActor.items))) {
        throw new Error('Item transfer support changed')
      }
      const currentAccess = this.canAccessContainer(container, this.actor)
      if (currentAccess.code) return currentAccess
      transaction = prepareOwnWrites([
        [sourceComponent, 'inventory', remaining], [sourceComponent, 'inventoryIndex', remaining.length],
        [destinationComponent, 'inventory', entries], [destinationComponent, 'inventoryIndex', entries.length],
        ...itemIds.map(id => [this.items.get(id).entity.item, 'parent', destination.sourcePath]),
      ])
      transaction.apply()
      const contents = validateOwnership(this.map, container)
      const inventory = this.actorInventory()
      if (contents.code || inventory.code) throw new Error('Transfer did not preserve reciprocal ownership')
      return { result: { kind, targetId: container.sourcePath, ...(all ? { itemIds } : { itemId }), items: contents.items, inventory } }
    } catch (_) {
      transaction?.rollback()
      return error('INVENTORY_UNAVAILABLE', 'Verified inventory state could not be changed safely')
    }
  }

  validateCurrent() {
    if (this.invalidBaseline) throw new Error('Ownership content is inconsistent')
    const assigned = new Set()
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
        if (!this.items.has(entry.id) || assigned.has(entry.id)) throw new Error('Item universe changed')
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
          entity.item.invLocation !== record.invLocation || quantity !== record.quantity || itemIdentity(entity) !== record.identity) {
        throw new Error('Item content changed')
      }
      if (record.groundCapable) {
        if (entity.ground) {
          const tileKey = position(entity).join(',')
          if (assigned.has(id) || entity.item.parent !== null || !this.groundPositionValid(position(entity)) || groundTiles.has(tileKey)) {
            throw new Error('Ground ownership changed')
          }
          assigned.add(id); groundTiles.add(tileKey)
        } else if (entity.item.parent === null || !same(position(entity), record.initialLocation)) {
          throw new Error('Held ground item placement changed')
        }
        if (this.map.getTile(...position(entity))?.[record.type]?.[entity.id] !== entity) {
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
    return ownership
  }

  validateCheckpoint(ownership) {
    this.validateCurrent()
    if (!exactKeys(ownership, ['owners', 'items']) || !Array.isArray(ownership.owners) || !Array.isArray(ownership.items) ||
        ownership.owners.length !== this.owners.size || ownership.items.length !== this.items.size) throw new Error('Invalid ownership set')
    const owners = new Map(), items = new Map(), assigned = new Map()
    for (const owner of ownership.owners) {
      if (!exactKeys(owner, ['id', 'inventoryIndex', 'items']) || !this.owners.has(owner.id) || owners.has(owner.id) ||
          !Array.isArray(owner.items) || owner.items.length > MAX_ITEMS || !Number.isSafeInteger(owner.inventoryIndex) ||
          owner.inventoryIndex !== owner.items.length) throw new Error('Invalid owner inventory')
      const slots = new Set()
      for (const entry of owner.items) {
        if (!exactKeys(entry, ['id', 'slot']) || !this.items.has(entry.id) || assigned.has(entry.id) ||
            !Number.isSafeInteger(entry.slot) || entry.slot < 0 || slots.has(entry.slot)) throw new Error('Invalid inventory entry')
        const original = this.items.get(entry.id)
        if (!original.movable) {
          if (owner.id !== original.initialOwner || entry.slot !== original.initialSlot) throw new Error('Immovable item changed')
        } else {
          const source = this.owners.get(original.initialOwner)?.entity
          const destination = this.owners.get(owner.id)
          if ((original.initialOwner !== null && source !== this.actor && !this.canTakeFrom(source)) ||
              (owner.id !== this.actor.sourcePath && (!destination.usableContainer || !this.canTakeFrom(destination.entity))) ||
              !(this.genericSupported(original.entity) || (this.standaloneKeys && this.keySupported(original.entity)))) {
            throw new Error('Unsupported ownership transfer')
          }
        }
        assigned.set(entry.id, owner.id); slots.add(entry.slot)
      }
      owners.set(owner.id, copyEntries(owner.items))
    }
    {
      // Put can leave holes in any inventory. A moved item may occupy any of
      // the first N free slots around immutable entries: earlier slots could
      // have held the other N-1 movable items before they were put elsewhere.
      // An untouched converted entry may retain its original sparse slot.
      for (const [id, entries] of owners) {
        const fixed = new Set(this.owners.get(id).entries.filter(entry => !this.items.get(entry.id).movable).map(entry => entry.slot))
        const allocated = new Set()
        let slot = 0
        for (let index = 0; index < Math.min(this.movableCount, MAX_ITEMS - fixed.size); index++) {
          while (fixed.has(slot)) slot++
          allocated.add(slot++)
        }
        for (const entry of entries) {
          const original = this.items.get(entry.id)
          if (original.movable && !(original.initialOwner === id && original.initialSlot === entry.slot) && !allocated.has(entry.slot)) {
            throw new Error('Transferred sparse slot is unreachable')
          }
        }
      }
    }
    const groundTiles = new Set(), placements = []
    for (const item of ownership.items) {
      if (!exactKeys(item, ['id', 'parent', 'groundLocation']) || !this.items.has(item.id) || items.has(item.id)) {
        throw new Error('Invalid reciprocal parent')
      }
      const record = this.items.get(item.id)
      if (item.parent === null) {
        if (!record.groundCapable || assigned.has(item.id) || !this.groundPositionValid(item.groundLocation) ||
            (!record.movable && !(record.initialOwner === null && same(item.groundLocation, record.initialLocation))) ||
            groundTiles.has(item.groundLocation.join(','))) throw new Error('Invalid ground placement')
        assigned.set(item.id, null); groundTiles.add(item.groundLocation.join(','))
      } else if (!this.owners.has(item.parent) || assigned.get(item.id) !== item.parent || item.groundLocation !== null) {
        throw new Error('Invalid reciprocal parent')
      }
      items.set(item.id, item.parent)
      if (record.groundCapable) placements.push([record, item.parent === null ? item.groundLocation : record.initialLocation, item.parent === null])
    }
    if (assigned.size !== this.items.size) throw new Error('An item disappeared')
    const values = []
    for (const [id, entries] of owners) {
      const component = this.owners.get(id).component
      values.push([component, 'inventory', entries], [component, 'inventoryIndex', entries.length])
    }
    for (const [id, parent] of items) values.push([this.items.get(id).entity.item, 'parent', parent])
    this.preparePlacements(placements, values)
    return prepareOwnWrites(values)
  }

  clear() { this.owners.clear(); this.items.clear() }
}
