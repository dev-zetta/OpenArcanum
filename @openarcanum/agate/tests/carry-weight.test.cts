import type { ActorEntity, AuthorityEntity, AuthorityMap, AuthorityTile, Flags, ItemEntity, Outcome } from '../dist-types/server/authority/AuthorityTypes'
import type { InventoryItem } from '../dist-types/server/authority/InventoryOwnership'

const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const root = path.resolve(__dirname, '../../..')
let engine: {
  InventoryOwnership: typeof import('../dist-types/server/authority/InventoryOwnership').default
  Location: typeof import('../dist-types/shared/Location').default
  calculateEncumbrance: typeof import('../dist-types/shared/character/CarryWeight').calculateEncumbrance
  carryingState: typeof import('../dist-types/shared/character/CarryWeight').carryingState
}

function success<Value extends object>(result: Outcome<Value>): Value {
  if (result.code !== undefined) assert.fail(`${result.code}: ${result.message}`)
  return result as Value
}

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({ absWorkingDir: root,
    stdin: { contents: `export { default as InventoryOwnership } from './server/authority/InventoryOwnership.ts';
      export { default as Location } from './shared/Location.ts';
      export { calculateEncumbrance, carryingState } from './shared/character/CarryWeight.ts';`,
      resolveDir: path.join(root, '@openarcanum/agate/src'), sourcefile: 'carry-weight-tests.ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

class FixtureFlags extends Set<string> implements Flags {
  hasAny(values: string[]): boolean { return values.some(value => this.has(value)) }
}
interface Definition { id: string; weight?: number; magicWeightAdj?: number; type?: string; owner?: 'actor' | 'box' | 'ground'; slot?: number }
function fixture(definitions: Definition[], getCarryCapacity?: () => number | null) {
  const entities = new Map<string, AuthorityEntity>(), tiles = new Map<string, AuthorityTile>()
  const map: AuthorityMap = {
    width: 1, height: 1, entityManager: { entities },
    pathFind: { findPath: () => [] }, isTileBlocked: () => false,
    getTile(x, y) {
      if (x < 0 || y < 0 || x >= 64 || y >= 64) return undefined
      const key = `${x},${y}`
      if (!tiles.has(key)) tiles.set(key, { type: 'floor' })
      return tiles.get(key)
    },
    moveEntity() {}, getStartLocation: () => new engine.Location(4, 4),
  }
  const actor: ActorEntity = { id: '0', sourcePath: '16086.json', map,
    base: { type: 'Pc', prototype: 1, location: new engine.Location(4, 4), flags: new FixtureFlags() },
    critter: { inventory: [], inventoryIndex: 0, inventorySource: 0 } }
  const box: AuthorityEntity & { container: NonNullable<AuthorityEntity['container']> } = { id: 'box', sourcePath: 'box', map,
    base: { type: 'Container', prototype: 2, location: new engine.Location(6, 4), flags: new FixtureFlags() },
    container: { inventory: [], inventoryIndex: 0, inventorySource: 0, flags: new FixtureFlags(), keyId: 0 } }
  entities.set(actor.id, actor); entities.set(box.id, box)
  const items = new Map<string, ItemEntity>()
  for (const [index, definition] of definitions.entries()) {
    const owner = definition.owner === 'actor' ? actor : definition.owner === 'ground' ? null : box
    const item: ItemEntity = { id: definition.id, sourcePath: definition.id, map,
      base: { type: definition.type || 'Generic', prototype: index + 3,
        location: new engine.Location(owner ? [6, 4] : [5, 4]),
        flags: new FixtureFlags(owner ? ['Inventory'] : ['NoBlock']) },
      item: { parent: owner?.sourcePath ?? null, invLocation: 7, flags: new FixtureFlags(),
        ...(definition.weight === undefined ? {} : { weight: definition.weight }),
        ...(definition.magicWeightAdj === undefined ? {} : { magicWeightAdj: definition.magicWeightAdj }),
        ...(!owner ? { groundTransferSupported: true } : {}) },
      ...(!owner ? { visual: { getCurrent: () => ({ type: 'Item', category: 'Workshop', subcat: 'Base', number: 1,
        display: 'Ground', stage: 'North', frame: 0 }) } } : {}),
      ...(definition.type === 'Key' ? { key: { keyId: 7001 } } : {}),
    }
    if (owner) {
      const component = owner === actor ? actor.critter : box.container
      component.inventory.push({ id: item.id, slot: definition.slot ?? index + 3 })
      component.inventoryIndex++
    }
    items.set(item.id, item); entities.set(item.id, item)
    const tile = map.getTile(item.base.location.x, item.base.location.y)!
    const occupants = (tile[item.base.type] as Record<string, AuthorityEntity> | undefined) || {}
    occupants[item.id] = item; tile[item.base.type] = occupants
  }
  const ownership = new engine.InventoryOwnership(map, actor, { canTakeFrom: entity => entity === box,
    ...(getCarryCapacity ? { getCarryCapacity } : {}) })
  const state = () => ({ actor: structuredClone(actor.critter.inventory), box: structuredClone(box.container.inventory),
    parents: [...items].map(([id, item]) => [id, item.item.parent]),
    locations: [...items].map(([id, item]) => [id, item.base.location.toArray(), item.ground]),
    tiles: [...tiles].map(([key, tile]) => [key, Object.fromEntries(Object.entries(tile).filter(([, value]) =>
      value && typeof value === 'object').map(([type, value]) => [type, Object.keys(value as object)]))]) })
  return { ownership, map, actor, box, items, state }
}

test('encumbrance uses seven strict truncated-integer percentage bands', () => {
  const levels = ['none', 'light', 'moderate', 'medium', 'significant', 'heavy', 'severe']
  const boundaries = [600, 1200, 1800, 2400, 3000, 3600]
  assert.equal(engine.calculateEncumbrance(0, 4000), 'none')
  for (const [index, weight] of boundaries.entries()) {
    assert.equal(engine.calculateEncumbrance(weight - 1, 4000), levels[index])
    assert.equal(engine.calculateEncumbrance(weight, 4000), levels[index + 1])
  }
  assert.equal(engine.calculateEncumbrance(4000, 4000), 'severe')
  assert.equal(engine.calculateEncumbrance(4001, 4000), 'severe')
  assert.equal(engine.calculateEncumbrance(18, 123), 'light', '123*15/100 truncates to 18 before strict comparison')
  assert.equal(engine.calculateEncumbrance(17, 123), 'none')
  const capacity = Number.MAX_SAFE_INTEGER
  const threshold = Number(BigInt(capacity) * 15n / 100n)
  assert.equal(engine.calculateEncumbrance(threshold, capacity), 'light')
  for (const [weight, limit] of [[-1, 4000], [1.5, 4000], [NaN, 4000], [0, 0], [0, Infinity], [0, 1.5]]) {
    assert.throws(() => engine.calculateEncumbrance(weight, limit))
  }
})

test('exact capacity succeeds, one additional stone rejects without changing ownership', () => {
  const f = fixture([{ id: 'ballast', weight: 4000 }, { id: 'token', weight: 1 }], () => 4000)
  assert.deepEqual(success(f.ownership.actorInventory()).carrying, engine.carryingState(0, 4000))
  assert.equal(f.ownership.take(f.box, 'ballast').code, undefined)
  const inventory = success(f.ownership.actorInventory())
  assert.deepEqual(inventory.carrying, engine.carryingState(4000, 4000))
  assert.equal(inventory.items[0].weight, 4000)
  const before = f.state()
  assert.equal(f.ownership.take(f.box, 'token').code, 'TOO_HEAVY')
  assert.deepEqual(f.state(), before)
  assert.equal(f.ownership.put(f.box, 'ballast').code, undefined)
  assert.deepEqual(success(f.ownership.actorInventory()).carrying, engine.carryingState(0, 4000))
})

test('a stronger validated capacity enables a formerly rejected whole-item transfer', () => {
  let capacity = 4000
  const f = fixture([{ id: 'ballast', weight: 4000, owner: 'actor' }, { id: 'token', weight: 1 }], () => capacity)
  assert.equal(f.ownership.take(f.box, 'token').code, 'TOO_HEAVY')
  capacity = 4500
  assert.equal(f.ownership.take(f.box, 'token').code, undefined)
  assert.deepEqual(success(f.ownership.actorInventory()).carrying, engine.carryingState(4001, 4500))
  capacity = 4000
  assert.equal(f.ownership.put(f.box, 'token').code, undefined, 'put can shed a valid over-capacity load')
})

test('Take All checks the combined batch and preserves every sparse slot and parent on rejection', () => {
  const f = fixture([{ id: 'held', weight: 10, owner: 'actor', slot: 9 },
    { id: 'first', weight: 2000, slot: 3 }, { id: 'second', weight: 1991, slot: 7 }], () => 4000)
  const before = f.state()
  assert.equal(f.ownership.takeAll(f.box).code, 'TOO_HEAVY')
  assert.deepEqual(f.state(), before)
  assert.equal(f.ownership.take(f.box, 'first').code, undefined)
  assert.equal(f.ownership.put(f.box, 'held').code, undefined)
  assert.equal(f.ownership.takeAll(f.box).code, 'TOO_HEAVY', 'putting an item into the source still counts in the complete batch')
})

test('Take All at exact capacity succeeds without losing item identity or sparse source metadata', () => {
  const f = fixture([{ id: 'first', weight: 1000, slot: 3 }, { id: 'second', weight: 3000, slot: 8 }], () => 4000)
  const result = success(f.ownership.takeAll(f.box))
  assert.deepEqual(result.result.itemIds, ['first', 'second'])
  assert.deepEqual(f.actor.critter.inventory, [{ id: 'first', slot: 0 }, { id: 'second', slot: 1 }])
  assert.deepEqual(result.result.inventory.carrying, engine.carryingState(4000, 4000))
  assert.equal(f.items.get('first')!.item.invLocation, 7)
})

test('missing, fractional, negative, unsafe and nonzero magical weights fail closed without mutation', () => {
  const definitions: Definition[] = [{ id: 'item' }, { id: 'item', weight: -1 }, { id: 'item', weight: 1.5 },
    { id: 'item', weight: NaN }, { id: 'item', weight: Infinity }, { id: 'item', weight: Number.MAX_SAFE_INTEGER + 1 },
    { id: 'item', weight: 5, magicWeightAdj: 1 }, { id: 'item', weight: 5, magicWeightAdj: NaN }]
  for (const definition of definitions) {
    const f = fixture([definition], () => 4000), before = f.state()
    assert.equal(f.ownership.take(f.box, 'item').code, 'INVENTORY_UNAVAILABLE')
    assert.deepEqual(f.state(), before)
    assert.equal(Object.hasOwn(f.ownership.privateItems([{ id: 'item', slot: 3, label: 'Item', type: 'Generic', prototypeId: 3 }])[0], 'weight'), false)
  }
  const f = fixture([{ id: 'zero', weight: 0, magicWeightAdj: 0 }], () => 4000)
  assert.equal(f.ownership.take(f.box, 'zero').code, undefined)
  assert.deepEqual(success(f.ownership.actorInventory()).carrying, engine.carryingState(0, 4000))
})

test('weight metadata is immutable and unsafe combined totals reject atomically', () => {
  for (const property of ['weight', 'magicWeightAdj'] as const) {
    const f = fixture([{ id: 'item', weight: 5, magicWeightAdj: 0 }], () => 4000)
    f.items.get('item')!.item[property] = property === 'weight' ? 6 : 1
    const before = f.state()
    assert.throws(() => f.ownership.validateCurrent())
    assert.throws(() => f.ownership.checkpointStates())
    assert.equal(f.ownership.take(f.box, 'item').code, 'INVENTORY_UNAVAILABLE')
    assert.deepEqual(f.state(), before)
  }
  const f = fixture([{ id: 'first', weight: Number.MAX_SAFE_INTEGER }, { id: 'second', weight: 1 }], () => Number.MAX_SAFE_INTEGER)
  const before = f.state()
  assert.equal(f.ownership.takeAll(f.box).code, 'INVENTORY_UNAVAILABLE')
  assert.deepEqual(f.state(), before)
})

test('invalid capacity providers and mutated held weights never produce a fabricated private total', () => {
  for (const capacity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture([{ id: 'held', weight: 1, owner: 'actor' }], () => capacity)
    assert.equal(f.ownership.actorInventory().code, 'INVENTORY_UNAVAILABLE')
    assert.doesNotThrow(() => f.ownership.privateItems([{ id: 'held', slot: 3, label: 'Item', type: 'Generic', prototypeId: 3 }]))
  }
  const f = fixture([{ id: 'held', weight: 1, owner: 'actor' }], () => 4000)
  f.items.get('held')!.item.weight = 2
  assert.equal(f.ownership.actorInventory().code, 'INVENTORY_UNAVAILABLE')
})

test('unknown held weight fails closed, while unsupported container-only item weight remains unknown', () => {
  const held = fixture([{ id: 'held', owner: 'actor' }], () => 4000)
  assert.equal(held.ownership.actorInventory().code, 'INVENTORY_UNAVAILABLE')
  const f = fixture([{ id: 'weapon', type: 'Weapon', weight: 10 }, { id: 'token', weight: 1 }], () => 4000)
  const rows: InventoryItem[] = [{ id: 'weapon', slot: 3, type: 'Weapon', label: 'Weapon', prototypeId: 3 },
    { id: 'token', slot: 4, type: 'Generic', label: 'Item', prototypeId: 4 }]
  const privateRows = f.ownership.privateItems(rows)
  assert.equal(Object.hasOwn(privateRows[0], 'weight'), false)
  assert.equal(privateRows[1].weight, 1)
  assert.equal(f.ownership.take(f.box, 'token').code, undefined)
})

test('pickup rejects excess weight and drop remains available to shed a valid overloaded load', () => {
  let capacity = 4000
  const f = fixture([{ id: 'ballast', weight: 4000, owner: 'actor' }, { id: 'pebble', weight: 1, owner: 'ground' }], () => capacity)
  const before = f.state()
  assert.equal(f.ownership.pickup('pebble').code, 'TOO_HEAVY')
  assert.deepEqual(f.state(), before)
  capacity = 4500
  assert.equal(f.ownership.pickup('pebble').code, undefined)
  capacity = 4000
  const result = success(f.ownership.drop('pebble'))
  assert.deepEqual(result.result.inventory.carrying, engine.carryingState(4000, 4000))
  assert.equal(f.items.get('pebble')!.item.parent, null)
  assert.deepEqual(f.items.get('pebble')!.base.location.toArray(), [4, 4])
})

test('checkpoint preflight checks saved capacity and leaves current state untouched', () => {
  let capacity = 4500
  const f = fixture([{ id: 'ballast', weight: 4000 }, { id: 'token', weight: 1 }], () => capacity)
  assert.equal(f.ownership.takeAll(f.box).code, undefined)
  const candidate = f.ownership.checkpointStates()
  assert.equal(f.ownership.put(f.box, 'token').code, undefined)
  assert.equal(f.ownership.put(f.box, 'ballast').code, undefined)
  capacity = 4000
  const before = f.state()
  assert.doesNotThrow(() => f.ownership.validateCheckpointWeight(candidate, 4500), 'saved Strength is used instead of current Strength')
  assert.throws(() => f.ownership.validateCheckpointWeight(candidate, 4000))
  assert.deepEqual(f.state(), before)
  const transaction = f.ownership.validateCheckpoint(candidate)
  capacity = 4500
  transaction.apply()
  assert.deepEqual(success(f.ownership.actorInventory()).carrying, engine.carryingState(4001, 4500))
  transaction.rollback()
  assert.deepEqual(f.state(), before)
  assert.throws(() => f.ownership.validateCheckpointWeight({ owners: [], items: [] }, 4500))
})

test('unsupported profiles preserve ownership behavior without inventing weights', () => {
  for (const getCarryCapacity of [undefined, () => null]) {
    const f = fixture([{ id: 'unknown' }], getCarryCapacity)
    assert.equal(f.ownership.take(f.box, 'unknown').code, undefined)
    const inventory = success(f.ownership.actorInventory())
    assert.equal(inventory.carrying?.supported, getCarryCapacity ? false : undefined)
    assert.equal(Object.hasOwn(inventory.items[0], 'weight'), false)
    assert.doesNotThrow(() => f.ownership.validateCheckpointWeight(f.ownership.checkpointStates(), null))
  }
})
