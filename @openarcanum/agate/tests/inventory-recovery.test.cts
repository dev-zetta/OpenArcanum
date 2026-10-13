const { mutableFixture } = require('./fixture-types.cts') as { mutableFixture: import('./fixture-types.cjs').MutableFixtureFactory }
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const crypto = require('node:crypto') as typeof import('node:crypto')
const recovery = require('../tools/recover-inventories.cts')

// Synthetic fixtures follow the documented wire layout independently of the
// decoder's named schema. No original game records are copied into these tests.
const OWNER = '00112233-4455-6677-8899-AABBCCDDEEFF'
const ITEM = '11223344-5566-7788-99AA-BBCCDDEEFF00'
const OTHER = '22334455-6677-8899-AABB-CCDDEEFF0011'
const MAP = 'Synthetic Map'
const ownerPath = `${MAP}/Sector/1/1/Container/${OWNER}.json`
const itemPath = `${MAP}/Sector/1/1/Gold/${ITEM}.json`
const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b }
const i32 = value => { const b = Buffer.alloc(4); b.writeInt32LE(value); return b }
const present = bytes => Buffer.concat([Buffer.from([1]), bytes])
function objectId(value, type = typeof value === 'number' ? 1 : value ? 2 : 0) {
  const bytes = Buffer.alloc(24, 0x5a) // historical padding/unused union is not zero
  bytes.writeInt16LE(type, 0)
  if (type === 1) bytes.writeUInt32LE(value, 8)
  if (type === 2) {
    const parts = value.split('-')
    bytes.writeUInt32LE(parseInt(parts[0], 16), 8)
    bytes.writeUInt16LE(parseInt(parts[1], 16), 12)
    bytes.writeUInt16LE(parseInt(parts[2], 16), 14)
    Buffer.from(parts.slice(3).join(''), 'hex').copy(bytes, 16)
  }
  return bytes
}
function sparseArray(entries, { elementSize = 24, words, count = entries.length }: {elementSize?: number; words?: number[]; count?: number} = {}) {
  if (!words) {
    words = Array.from({ length: entries.length ? Math.floor(Math.max(...entries.map(e => e.slot)) / 32) + 1 : 0 }, () => 0)
    for (const entry of entries) words[Math.floor(entry.slot / 32)] = (words[Math.floor(entry.slot / 32)] | 1 << entry.slot % 32) >>> 0
  }
  return present(Buffer.concat([u32(elementSize), u32(count), u32(0xdeadbeef),
    ...entries.map(e => e.bytes || objectId(e.id)), u32(words.length), ...words.map(u32)]))
}
const sectionLengths = type => type === 2 ? [36, 11] : [36, 23, 6]
function mobile({ id = OWNER, prototype = 3044, type = 2, sections = [new Map(), new Map()] } = {}) {
  const lengths = sectionLengths(type)
  const head = Buffer.concat([u32(0x77), objectId(prototype), objectId(id), u32(type), Buffer.alloc(2)])
  let count = 0
  const masks = [], payload = []
  lengths.forEach((length, section) => {
    const fields = sections[section] || new Map()
    const words = Array.from({ length: Math.ceil(length / 32) }, () => 0)
    for (const [index, bytes] of [...fields].sort((a, b) => a[0] - b[0])) {
      words[Math.floor(index / 32)] = (words[Math.floor(index / 32)] | 1 << index % 32) >>> 0
      payload.push(bytes)
      count++
    }
    masks.push(...words.map(u32))
  })
  head.writeUInt16LE(count, 56)
  return Buffer.concat([head, ...masks, ...payload])
}
function prototype({ id = 3044, type = 2, overrides = [] } = {}) {
  const lengths = sectionLengths(type)
  const nullable = [[1, 5, 6, 7, 15, 16, 17, 30, 31, 34, 35],
    type === 2 ? [4, 9, 10] : [1, 21, 22], [4, 5]]
  const data = []
  lengths.forEach((length, section) => {
    for (let index = 0; index < length; index++) {
      data.push(overrides[section]?.get(index) || (nullable[section].includes(index) ? Buffer.from([0]) : i32(0)))
    }
  })
  return Buffer.concat([u32(0x77), objectId(null, -1), objectId(id), u32(type),
    ...lengths.flatMap(n => Array.from({ length: Math.ceil(n / 32) }, () => u32(0))), ...data])
}
const location = (x, y) => present(Buffer.concat([u32(y), u32(x)]))
const ownerMobile = () => mobile({ sections: [new Map([[1, location(12, 14)]]),
  new Map([[3, i32(1)], [4, sparseArray([{ slot: 5, id: ITEM }])]])] })
const itemMobile = () => mobile({ id: ITEM, prototype: 9076, type: 8,
  sections: [new Map([[1, location(99, 1)], [18, i32(0x1000)]]),
    new Map([[1, present(objectId(OWNER))], [7, i32(1006)]]), new Map([[1, i32(42)]])] })

function zip(entries) {
  const local = [], central = []
  let offset = 0
  for (const [name, content] of entries) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content)
    const filename = Buffer.from(name)
    let crc = 0xffffffff
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1 }
    crc = (crc ^ 0xffffffff) >>> 0
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x800, 6)
    head.writeUInt16LE(0x21, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(bytes.length, 18)
    head.writeUInt32LE(bytes.length, 22); head.writeUInt16LE(filename.length, 26)
    local.push(head, filename, bytes)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x800, 8); entry.writeUInt16LE(0x21, 14); entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24)
    entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42)
    central.push(entry, filename)
    offset += head.length + filename.length + bytes.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}
async function archives(t, mutate = (_fixture) => {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openarcanum-inventory-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const sourceName = id => `#UNPACKED/Arcanum/maps/${MAP}/G_${id.replaceAll('-', '_')}.mob`
  const original = new Map([[sourceName(OWNER), ownerMobile()], [sourceName(ITEM), itemMobile()],
    ['#UNPACKED/proto/003044 - Container.pro', prototype()],
    ['#UNPACKED/proto/009076 - Gold.pro', prototype({ id: 9076, type: 8 })]])
  const container = { Base: { type: 'Container', prototype: 3044, location: [12, 14] }, Container: { inventoryIndex: 1, flags: ['Locked'] } }
  const item = { Base: { type: 'Gold', prototype: 9076, location: [99, 1], flags: ['Inventory'] }, Item: { invLocation: 1006 }, Gold: { quantity: 42 } }
  const converted = new Map([[ownerPath, JSON.stringify(container)], [itemPath, JSON.stringify(item)]])
  mutate({ original, converted, sourceName, container, item })
  const originalArchive = path.join(directory, 'original.zip'), convertedArchive = path.join(directory, 'converted.zip')
  await fs.writeFile(originalArchive, zip([...original])); await fs.writeFile(convertedArchive, zip([...converted]))
  const dataPath = path.join(directory, 'data'); await fs.mkdir(dataPath)
  return { directory, originalArchive, convertedArchive, dataPath, mapId: MAP, container, item }
}

test('MOB reads Windows GUID byte order, nonzero historical padding and sparse slots across word boundaries', () => {
  const bytes = mobile({ sections: [new Map([[1, location(123, 456)]]), new Map([[3, i32(3)],
    [4, sparseArray([{ slot: 0, id: ITEM }, { slot: 31, id: OTHER }, { slot: 35, id: OWNER }])]])] })
  const before = Buffer.from(bytes), result = recovery.parseMobile(bytes)
  assert.equal(result.id, OWNER); assert.equal(result.prototype, 3044)
  assert.deepEqual(result.fields.LOCATION, { low: 456, high: 123 })
  assert.deepEqual(result.fields.CONTAINER_INVENTORY_LIST_IDX.entries.map(e => [e.slot, e.value.id]), [[0, ITEM], [31, OTHER], [35, OWNER]])
  assert.deepEqual(bytes, before)
})

test('MOB rejects invalid versions, types, header IDs, field counts and unknown override bits', () => {
  const valid = mobile()
  for (const [offset, value, pattern] of [[0, 1, /version/], [52, 3, /object type/], [4, 0, /header IDs/], [28, 1, /header IDs/], [62, 16, /field bits/]] as const) {
    const bytes = Buffer.from(valid); bytes.writeUInt32LE(value, offset)
    assert.throws(() => recovery.parseMobile(bytes), pattern)
  }
  const count = Buffer.from(valid); count.writeUInt16LE(1, 56)
  assert.throws(() => recovery.parseMobile(count), /field count/)
  const runtime = Buffer.from(valid); runtime.writeInt16LE(-2, 28)
  assert.throws(() => recovery.parseMobile(runtime), /ObjectID type/)
})

test('MOB rejects every truncation boundary, extra bytes and invalid nullable presence markers', () => {
  const bytes = ownerMobile()
  for (let size = 0; size < bytes.length; size++) assert.throws(() => recovery.parseMobile(bytes.subarray(0, size)), /Truncated|array count/)
  assert.throws(() => recovery.parseMobile(Buffer.concat([bytes, Buffer.from([0])])), /Trailing bytes/)
  assert.throws(() => recovery.parseMobile(mobile({ sections: [new Map([[1, Buffer.from([2])]])] })), /presence marker/)
})

test('MOB sparse arrays reject wrong element size, count mismatch and unbounded bitsets/counts', () => {
  for (const encoded of [sparseArray([{ slot: 0, id: ITEM }], { elementSize: 4 }),
    sparseArray([{ slot: 0, id: ITEM }], { words: [0] }),
    sparseArray([{ slot: 0, id: ITEM }], { words: [3] }),
    present(Buffer.concat([u32(24), u32(65537), u32(0)])),
    present(Buffer.concat([u32(24), u32(0), u32(0), u32(4097)]))] as const) {
    const bytes = mobile({ sections: [new Map(), new Map([[4, encoded]])] })
    assert.throws(() => recovery.parseMobile(bytes), /array size or count|array count|bitset is too large/)
  }
})

test('PRO consumes all fields even with an empty modified-field bitmap and proves inherited empty inventory', () => {
  const parsed = recovery.parsePrototype(prototype())
  assert.equal(parsed.id, 3044); assert.equal(parsed.type, 'Container')
  assert.equal(Object.keys(parsed.fields).length, 47)
  assert.equal(parsed.fields.CONTAINER_INVENTORY_NUM, 0)
  assert.equal(parsed.fields.CONTAINER_INVENTORY_LIST_IDX, null)
  const gold = recovery.parsePrototype(prototype({ id: 9076, type: 8 }))
  assert.equal(Object.keys(gold.fields).length, 65)
  assert.equal(gold.fields.ITEM_PARENT, null)
  assert.equal(gold.fields.ITEM_INV_LOCATION, 0)
  const bytes = prototype()
  assert.throws(() => recovery.parsePrototype(bytes.subarray(0, -1)), /Truncated/)
  assert.throws(() => recovery.parsePrototype(Buffer.concat([bytes, u32(0)])), /Trailing bytes/)
  const bad = Buffer.from(bytes); bad.writeInt16LE(1, 4)
  assert.throws(() => recovery.parsePrototype(bad), /header IDs/)
})

function ownership() {
  return [{ id: OWNER, convertedEntry: ownerPath, definition: { owner: 'Container', prefix: 'CONTAINER' },
    effectiveFields: { CONTAINER_INVENTORY_NUM: 1, CONTAINER_INVENTORY_LIST_IDX: { entries: [{ slot: 5, value: { kind: 'guid', id: ITEM } }] } } },
  { id: ITEM, convertedEntry: itemPath, definition: { item: true }, effectiveFields: { FLAGS: 0x1000, ITEM_PARENT: { kind: 'guid', id: OWNER }, ITEM_INV_LOCATION: 1006 } }].map(mutableFixture)
}
test('ownership requires reciprocal GUIDs and preserves owner sparse slots independently of item UI/equipment location', () => {
  const records = ownership(), result = recovery.buildOwnership(records)
  assert.deepEqual(result.get(OWNER), [{ id: itemPath, slot: 5 }])
  assert.equal(records[1].parentPath, ownerPath)
  records[0].effectiveFields.CONTAINER_INVENTORY_NUM = 0
  records[0].effectiveFields.CONTAINER_INVENTORY_LIST_IDX = null
  records[1].effectiveFields.ITEM_PARENT = null; records[1].effectiveFields.FLAGS = 0
  assert.deepEqual(recovery.buildOwnership(records).get(OWNER), [])
  assert.equal(records[1].parentPath, null)
})
test('ownership rejects missing, duplicate, non-item, nonreciprocal and unflagged membership', () => {
  const cases = [
    records => records.push(records[0]),
    records => records[0].effectiveFields.CONTAINER_INVENTORY_NUM++,
    records => records[0].effectiveFields.CONTAINER_INVENTORY_LIST_IDX.entries[0].value.id = OTHER,
    records => records[1].definition = { owner: 'Container', prefix: 'CONTAINER' },
    records => records[1].effectiveFields.ITEM_PARENT.id = OTHER,
    records => records[1].effectiveFields.ITEM_PARENT = null,
    records => records[1].effectiveFields.ITEM_PARENT.kind = 'prototype',
    records => records[1].effectiveFields.FLAGS = 0,
    records => delete records[1].effectiveFields.FLAGS,
    records => records[0].effectiveFields.CONTAINER_INVENTORY_LIST_IDX.entries[0].slot = -1,
    records => { const fields = records[0].effectiveFields; fields.CONTAINER_INVENTORY_NUM = 2; fields.CONTAINER_INVENTORY_LIST_IDX.entries.push(fields.CONTAINER_INVENTORY_LIST_IDX.entries[0]) },
    records => { const other = structuredClone(records[0]); other.id = OTHER; records.push(other) },
  ] as const
  for (const mutate of cases) { const records = ownership(); mutate(records); assert.throws(() => recovery.buildOwnership(records)) }
})

test('archive recovery correlates canonical type/prototype paths and hashes every input/output without modifying sources', async t => {
  const options = await archives(t, ({ converted }) => {
    // An unrelated legacy scenery duplicate must not make this MOB ambiguous.
    converted.set(`${MAP}/Sector/1/1/Scenery/${OWNER}.json`, '{}')
  })
  const before = await Promise.all([options.originalArchive, options.convertedArchive].map(file => fs.readFile(file)))
  const result = await recovery.prepareRecovery(options)
  assert.deepEqual(result.manifest.summary, { records: 2, containers: 1, npcs: 0, items: 1, containerItems: 1, npcItems: 0, groundItems: 0 })
  assert.equal(result.manifest.prototypes.length, 2)
  assert.equal(result.manifest.referenceCommit, 'a7ff41b300ef712f0e7d088183a3d08957110cdd')
  const byPath = new Map<string, {Container?: {inventory: unknown}; Item?: {parent?: string; invLocation?: number}; Gold?: {quantity: number}}>(result.files.map(f => [f.relativePath, JSON.parse(f.contents)]))
  assert.deepEqual(byPath.get(ownerPath).Container.inventory, [{ id: itemPath, slot: 5 }])
  assert.equal(byPath.get(itemPath).Item.parent, ownerPath)
  assert.equal(byPath.get(itemPath).Item.invLocation, 1006)
  assert.equal(byPath.get(itemPath).Gold.quantity, 42)
  const item = result.manifest.records.find(r => r.guid === ITEM)
  assert.equal(item.inventoryLocation, 1006)
  for (const record of result.manifest.records) {
    assert.match(record.sourceSha256, /^[a-f0-9]{64}$/); assert.match(record.convertedSha256, /^[a-f0-9]{64}$/)
    const file = result.files.find(f => f.relativePath === record.id)
    assert.equal(record.outputSha256, crypto.createHash('sha256').update(file.contents).digest('hex'))
  }
  assert.deepEqual(await Promise.all([options.originalArchive, options.convertedArchive].map(file => fs.readFile(file))), before)
  assert.deepEqual(await fs.readdir(options.dataPath), [])
})

test('recovery preserves existing loose instance overlays, records their hashes and rejects conflicting metadata', async t => {
  const options = await archives(t), filename = path.join(options.dataPath, ownerPath)
  await fs.mkdir(path.dirname(filename), { recursive: true })
  const loose = mutableFixture({ ...options.container, Base: { ...options.container.Base, offset: [7, -8] }, CustomMod: { enabled: true } })
  const raw = JSON.stringify(loose)
  await fs.writeFile(filename, raw)
  const result = await recovery.prepareRecovery(options), output = JSON.parse(result.files.find(f => f.relativePath === ownerPath).contents)
  assert.deepEqual(output.Base.offset, [7, -8]); assert.deepEqual(output.CustomMod, { enabled: true })
  assert.equal(result.manifest.records.find(r => r.guid === OWNER).overlaySha256, crypto.createHash('sha256').update(raw).digest('hex'))
  assert.equal(await fs.readFile(filename, 'utf8'), raw)
  loose.Container.inventory = []; await fs.writeFile(filename, JSON.stringify(loose))
  await assert.rejects(recovery.prepareRecovery(options), /metadata conflicts/)
})

test('recovery rejects archive filename/header mismatches, wrong converted identity/location and absent original defaults', async t => {
  const cases = [
    ({ original, sourceName }) => { const bytes = original.get(sourceName(OWNER)); original.delete(sourceName(OWNER)); original.set(sourceName(OTHER), bytes) },
    ({ converted }) => converted.delete(ownerPath),
    ({ converted, container }) => converted.set(ownerPath, JSON.stringify({ ...container, Base: { ...container.Base, prototype: 999 } })),
    ({ converted, container }) => converted.set(ownerPath, JSON.stringify({ ...container, Base: { ...container.Base, type: 'Npc' } })),
    ({ converted, container }) => converted.set(ownerPath, JSON.stringify({ ...container, Base: { ...container.Base, location: [14, 12] } })),
    ({ original }) => original.delete('#UNPACKED/proto/003044 - Container.pro'),
    ({ converted, container }) => converted.set(`${MAP}/Sector/2/1/Container/${OWNER}.json`, JSON.stringify(container)),
    ({ converted }) => converted.set(ownerPath, 'broken JSON'),
  ] as const
  for (const mutate of cases) { const options = await archives(t, mutate); await assert.rejects(recovery.prepareRecovery(options)) }
})

test('recovery requires a safe explicit map and data root and rejects symlink loose files', async t => {
  await assert.rejects(recovery.prepareRecovery({ mapId: '../escape', dataPath: '/tmp' }), /map ID/)
  await assert.rejects(recovery.prepareRecovery({ mapId: MAP }), /explicit local data/)
  const options = await archives(t), filename = path.join(options.dataPath, ownerPath)
  await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.symlink(options.convertedArchive, filename)
  await assert.rejects(recovery.prepareRecovery(options), /loose instance overlay/)
})

test('recovery checks cached prototype types for every MOB instead of inheriting defaults from another class', async t => {
  const options = await archives(t, ({ original, converted, sourceName, item }) => {
    // Owner sorts before ITEM and warms the 3044 prototype cache.
    const bytes = original.get(sourceName(ITEM)); bytes.writeUInt32LE(3044, 12)
    converted.set(itemPath, JSON.stringify({ ...item, Base: { ...item.Base, prototype: 3044 } }))
  })
  await assert.rejects(recovery.prepareRecovery(options), /prototype ID\/type mismatch/)
})

test('recovery rejects present malformed components instead of silently replacing loose data', async t => {
  for (const component of [false, 0, '', null, []] as const) {
    const options = await archives(t, ({ converted, container }) => converted.set(ownerPath, JSON.stringify({ ...container, Container: component })))
    await assert.rejects(recovery.prepareRecovery(options), /metadata conflicts/)
  }
  const options = await archives(t, ({ converted, item }) => converted.set(itemPath, JSON.stringify({ ...item, Item: null })))
  await assert.rejects(recovery.prepareRecovery(options), /item parent conflicts/)
})

test('recovery emits explicit verified empty ownership from prototype defaults', async t => {
  const options = await archives(t, ({ original, converted, sourceName, container }) => {
    original.delete(sourceName(ITEM)); converted.delete(itemPath)
    original.set(sourceName(OWNER), mobile({ sections: [new Map([[1, location(12, 14)]])] }))
    converted.set(ownerPath, JSON.stringify({ ...container, Container: {} }))
  })
  const result = await recovery.prepareRecovery(options)
  assert.equal(result.manifest.summary.records, 1)
  assert.equal(result.manifest.summary.containerItems, 0)
  assert.deepEqual(JSON.parse(result.files[0].contents).Container.inventory, [])
  assert.equal(result.manifest.records[0].inventoryCount, 0)
})

test('writer creates only a new ignored overlay and refuses overwrite, escape, duplicate paths and symlink ancestors', async t => {
  const localData = path.resolve(__dirname, '../../../local-data')
  await fs.mkdir(localData, { recursive: true })
  const directory = await fs.mkdtemp(path.join(localData, '.inventory-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const prepared = { files: [{ relativePath: ownerPath, contents: '{}\n' }], manifest: { format: 'synthetic' } }
  const output = path.join(directory, 'output')
  await recovery.writeRecovery(prepared, output)
  assert.equal(await fs.readFile(path.join(output, ownerPath), 'utf8'), '{}\n')
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, 'recovery-manifest.json'), 'utf8')), prepared.manifest)
  await assert.rejects(recovery.writeRecovery(prepared, output), /already exists/)
  await assert.rejects(recovery.writeRecovery(prepared, path.join(os.tmpdir(), 'unsafe-inventory-output')), /inside this checkout local-data/)
  await assert.rejects(recovery.writeRecovery({ ...prepared, files: [{ relativePath: '../escape', contents: '{}' }] }, path.join(directory, 'escape')), /output path/)
  await assert.rejects(recovery.writeRecovery({ ...prepared, files: [...prepared.files, ...prepared.files] }, path.join(directory, 'duplicates')), /output path/)
  await fs.symlink(os.tmpdir(), path.join(directory, 'symlink'))
  await assert.rejects(recovery.writeRecovery(prepared, path.join(directory, 'symlink', 'output')), /ancestor/)
  assert.equal((await fs.readdir(directory)).filter(name => name.startsWith('.inventory-recovery-')).length, 0)
})
