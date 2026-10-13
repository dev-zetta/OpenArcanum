type ByteInput = Uint8Array | ArrayBuffer
export type SerializedId = {kind: 'null' | 'blocked'} | {kind: 'prototype'; id: number} | {kind: 'guid'; id: string} | {kind: 'position'; x: number; y: number; temporaryId: number; map: number}
interface PackedLocation {low: number; high: number}
interface SparseArray {elementSize: number; entries: {slot: number; value: SerializedId | string}[]}
type FieldValue = number | null | PackedLocation | SerializedId | SparseArray
interface Definition {name: string; sections: [string, string][][]; owner?: string; prefix?: string; item?: boolean}
interface ParsedRecord {id: string | number; prototype: number; type: string; definition: Definition; fields: Record<string, FieldValue>}
interface MobileRecord extends ParsedRecord {id: string}
interface PrototypeRecord extends ParsedRecord {id: number; sourceEntry?: string; sourceSha256?: string}
interface OwnershipRecord {id: string; definition: Definition; effectiveFields: Record<string, FieldValue>; convertedEntry: string; parentPath?: string | null}
interface ConvertedRecord {Base: {type: string; prototype: number; location?: unknown}; [component: string]: unknown}
interface RecoveredRecord extends MobileRecord, OwnershipRecord {converted: ConvertedRecord; sourceEntry: string; sourceSha256: string; convertedSha256: string; overlaySha256?: string}
interface ArchiveReader {entryData(name: string): Promise<Buffer>}
interface ArchiveEntries {[name: string]: {size: number}}
interface RecoveryOptions {originalArchive: string; convertedArchive: string; mapId: string; dataPath: string}
interface OutputFiles {files: {relativePath: string; contents: string}[]; manifest: unknown}
interface CliOptions {original?: string; converted?: string; data?: string; map?: string; output?: string; dryRun?: boolean}
'use strict'

// Local source-only recovery; original MOB/PRO data is never bundled here.
// Serialization and field order: arcanum-ce commit
// a7ff41b300ef712f0e7d088183a3d08957110cdd, src/game/{obj.c,obj.h,
// obj_private.c,obj_id.h,sa.c}. The supported types cover the Bates MOB set.
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const path = require('node:path') as typeof import('node:path')
const crypto = require('node:crypto') as typeof import('node:crypto')

const MAX_RECORD_BYTES = 4 * 1024 * 1024
const MAX_ARRAY_COUNT = 65536
const MAX_BITSET_WORDS = 4096
const INVENTORY_FLAG = 0x1000
const GUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
const sha256 = (bytes: import("node:crypto").BinaryLike) => crypto.createHash('sha256').update(bytes).digest('hex')
const schema = (text: string): [string, string][] => text.trim().split(/\s+/).map(field => field.split(':') as [string, string])
// i = signed INT32; q = presence + INT64; h = presence + ObjectID;
// aN = presence + sizeable array of N-byte records; ah = ObjectID array.
const BASE = schema(`CURRENT_AID:i LOCATION:q OFFSET_X:i OFFSET_Y:i SHADOW:i
  OVERLAY_FORE:a4 OVERLAY_BACK:a4 UNDERLAY:a4 BLIT_FLAGS:i BLIT_COLOR:i BLIT_ALPHA:i
  BLIT_SCALE:i LIGHT_FLAGS:i LIGHT_AID:i LIGHT_COLOR:i OVERLAY_LIGHT_FLAGS:a4
  OVERLAY_LIGHT_AID:a4 OVERLAY_LIGHT_COLOR:a4 FLAGS:i SPELL_FLAGS:i BLOCKING_MASK:i
  NAME:i DESCRIPTION:i AID:i DESTROYED_AID:i AC:i HP_PTS:i HP_ADJ:i HP_DAMAGE:i
  MATERIAL:i RESISTANCE_IDX:a4 SCRIPTS_IDX:a12 SOUND_EFFECT:i CATEGORY:i
  PAD_IAS_1:a4 PAD_I64AS_1:a8`)
const CONTAINER = schema(`CONTAINER_FLAGS:i CONTAINER_LOCK_DIFFICULTY:i CONTAINER_KEY_ID:i
  CONTAINER_INVENTORY_NUM:i CONTAINER_INVENTORY_LIST_IDX:ah CONTAINER_INVENTORY_SOURCE:i
  CONTAINER_NOTIFY_NPC:i CONTAINER_PAD_I_1:i CONTAINER_PAD_I_2:i
  CONTAINER_PAD_IAS_1:a4 CONTAINER_PAD_I64AS_1:a8`)
const ITEM = schema(`ITEM_FLAGS:i ITEM_PARENT:h ITEM_WEIGHT:i ITEM_MAGIC_WEIGHT_ADJ:i
  ITEM_WORTH:i ITEM_MANA_STORE:i ITEM_INV_AID:i ITEM_INV_LOCATION:i ITEM_USE_AID_FRAGMENT:i
  ITEM_MAGIC_TECH_COMPLEXITY:i ITEM_DISCIPLINE:i ITEM_DESCRIPTION_UNKNOWN:i ITEM_DESCRIPTION_EFFECTS:i
  ITEM_SPELL_1:i ITEM_SPELL_2:i ITEM_SPELL_3:i ITEM_SPELL_4:i ITEM_SPELL_5:i ITEM_SPELL_MANA_STORE:i
  ITEM_AI_ACTION:i ITEM_PAD_I_1:i ITEM_PAD_IAS_1:a4 ITEM_PAD_I64AS_1:a8`)
const CRITTER = schema(`CRITTER_FLAGS:i CRITTER_FLAGS2:i CRITTER_STAT_BASE_IDX:a4
  CRITTER_BASIC_SKILL_IDX:a4 CRITTER_TECH_SKILL_IDX:a4 CRITTER_SPELL_TECH_IDX:a4
  CRITTER_FATIGUE_PTS:i CRITTER_FATIGUE_ADJ:i CRITTER_FATIGUE_DAMAGE:i CRITTER_CRIT_HIT_CHART:i
  CRITTER_EFFECTS_IDX:a4 CRITTER_EFFECT_CAUSE_IDX:a4 CRITTER_FLEEING_FROM:h CRITTER_PORTRAIT:i
  CRITTER_GOLD:h CRITTER_ARROWS:h CRITTER_BULLETS:h CRITTER_POWER_CELLS:h CRITTER_FUEL:h
  CRITTER_INVENTORY_NUM:i CRITTER_INVENTORY_LIST_IDX:ah CRITTER_INVENTORY_SOURCE:i
  CRITTER_DESCRIPTION_UNKNOWN:i CRITTER_FOLLOWER_IDX:ah CRITTER_TELEPORT_DEST:q
  CRITTER_TELEPORT_MAP:i CRITTER_DEATH_TIME:i CRITTER_AUTO_LEVEL_SCHEME:i CRITTER_PAD_I_1:i
  CRITTER_PAD_I_2:i CRITTER_PAD_I_3:i CRITTER_PAD_IAS_1:a4 CRITTER_PAD_I64AS_1:a8`)
const TYPES = new Map<number, Definition>([
  [2, { name: 'Container', sections: [BASE, CONTAINER], owner: 'Container', prefix: 'CONTAINER' }],
  [5, { name: 'Weapon', sections: [BASE, ITEM, schema(`WEAPON_FLAGS:i WEAPON_PAPER_DOLL_AID:i
    WEAPON_BONUS_TO_HIT:i WEAPON_MAGIC_HIT_ADJ:i WEAPON_DAMAGE_LOWER_IDX:a4 WEAPON_DAMAGE_UPPER_IDX:a4
    WEAPON_MAGIC_DAMAGE_ADJ_IDX:a4 WEAPON_SPEED_FACTOR:i WEAPON_MAGIC_SPEED_ADJ:i WEAPON_RANGE:i
    WEAPON_MAGIC_RANGE_ADJ:i WEAPON_MIN_STRENGTH:i WEAPON_MAGIC_MIN_STRENGTH_ADJ:i WEAPON_AMMO_TYPE:i
    WEAPON_AMMO_CONSUMPTION:i WEAPON_MISSILE_AID:i WEAPON_VISUAL_EFFECT_AID:i WEAPON_CRIT_HIT_CHART:i
    WEAPON_MAGIC_CRIT_HIT_CHANCE:i WEAPON_MAGIC_CRIT_HIT_EFFECT:i WEAPON_CRIT_MISS_CHART:i
    WEAPON_MAGIC_CRIT_MISS_CHANCE:i WEAPON_MAGIC_CRIT_MISS_EFFECT:i WEAPON_PAD_I_1:i WEAPON_PAD_I_2:i
    WEAPON_PAD_IAS_1:a4 WEAPON_PAD_I64AS_1:a8`)], item: true }],
  [6, { name: 'Ammo', sections: [BASE, ITEM, schema(`AMMO_FLAGS:i AMMO_QUANTITY:i AMMO_TYPE:i
    AMMO_PAD_I_1:i AMMO_PAD_I_2:i AMMO_PAD_IAS_1:a4 AMMO_PAD_I64AS_1:a8`)], item: true }],
  [7, { name: 'Armor', sections: [BASE, ITEM, schema(`ARMOR_FLAGS:i ARMOR_PAPER_DOLL_AID:i
    ARMOR_AC_ADJ:i ARMOR_MAGIC_AC_ADJ:i ARMOR_RESISTANCE_ADJ_IDX:a4 ARMOR_MAGIC_RESISTANCE_ADJ_IDX:a4
    ARMOR_SILENT_MOVE_ADJ:i ARMOR_MAGIC_SILENT_MOVE_ADJ:i ARMOR_UNARMED_BONUS_DAMAGE:i ARMOR_PAD_I_2:i
    ARMOR_PAD_IAS_1:a4 ARMOR_PAD_I64AS_1:a8`)], item: true }],
  [8, { name: 'Gold', sections: [BASE, ITEM, schema(`GOLD_FLAGS:i GOLD_QUANTITY:i GOLD_PAD_I_1:i
    GOLD_PAD_I_2:i GOLD_PAD_IAS_1:a4 GOLD_PAD_I64AS_1:a8`)], item: true }],
  [13, { name: 'Written', sections: [BASE, ITEM, schema(`WRITTEN_FLAGS:i WRITTEN_SUBTYPE:i
    WRITTEN_TEXT_START_LINE:i WRITTEN_TEXT_END_LINE:i WRITTEN_PAD_I_1:i WRITTEN_PAD_I_2:i
    WRITTEN_PAD_IAS_1:a4 WRITTEN_PAD_I64AS_1:a8`)], item: true }],
  [14, { name: 'Generic', sections: [BASE, ITEM, schema(`GENERIC_FLAGS:i GENERIC_USAGE_BONUS:i
    GENERIC_USAGE_COUNT_REMAINING:i GENERIC_PAD_IAS_1:a4 GENERIC_PAD_I64AS_1:a8`)], item: true }],
  [16, { name: 'Npc', sections: [BASE, CRITTER, schema(`NPC_FLAGS:i NPC_LEADER:h NPC_AI_DATA:i
    NPC_COMBAT_FOCUS:h NPC_WHO_HIT_ME_LAST:h NPC_EXPERIENCE_WORTH:i NPC_EXPERIENCE_POOL:i
    NPC_WAYPOINTS_IDX:a8 NPC_WAYPOINT_CURRENT:i NPC_STANDPOINT_DAY:q NPC_STANDPOINT_NIGHT:q
    NPC_ORIGIN:i NPC_FACTION:i NPC_RETAIL_PRICE_MULTIPLIER:i NPC_SUBSTITUTE_INVENTORY:h
    NPC_REACTION_BASE:i NPC_SOCIAL_CLASS:i NPC_REACTION_PC_IDX:ah NPC_REACTION_LEVEL_IDX:a4
    NPC_REACTION_TIME_IDX:a4 NPC_WAIT:i NPC_GENERATOR_DATA:i NPC_PAD_I_1:i NPC_DAMAGE_IDX:a4
    NPC_SHIT_LIST_IDX:ah`)], owner: 'Critter', prefix: 'CRITTER' }],
])

class Reader {
  declare buffer: Buffer
  declare offset: number
  constructor(input: ByteInput) {
    this.buffer = Buffer.isBuffer(input) ? input : input instanceof ArrayBuffer ? Buffer.from(input) : Buffer.from(input)
    if (this.buffer.length > MAX_RECORD_BYTES) throw new Error('MOB/PRO record is too large')
    this.offset = 0
  }
  bytes(size: number): Buffer {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.buffer.length) {
      throw new Error('Truncated MOB/PRO record')
    }
    const value = this.buffer.subarray(this.offset, this.offset + size)
    this.offset += size
    return value
  }
  u32() { return this.bytes(4).readUInt32LE() }
  presence() {
    const value = this.bytes(1)[0]
    if (value !== 0 && value !== 1) throw new Error('Invalid MOB/PRO presence marker')
    return value
  }
}

function objectId(bytes: Buffer, { blocked = false } = {}): SerializedId {
  const type = bytes.readInt16LE(0)
  if (type === 0) return { kind: 'null' }
  if (type === -1 && blocked) return { kind: 'blocked' }
  if (type === 1) return { kind: 'prototype', id: bytes.readUInt32LE(8) }
  if (type === 2) {
    const hex = bytes.subarray(8).toString('hex').toUpperCase()
    const id = `${bytes.readUInt32LE(8).toString(16).padStart(8, '0')}-${bytes.readUInt16LE(12).toString(16).padStart(4, '0')}-${bytes.readUInt16LE(14).toString(16).padStart(4, '0')}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
    if (/^0+-0+-0+-0+-0+$/.test(id)) throw new Error('Invalid null GUID object ID')
    return { kind: 'guid', id }
  }
  if (type === 3) return { kind: 'position', x: bytes.readUInt32LE(8), y: bytes.readUInt32LE(12),
    temporaryId: bytes.readInt32LE(16), map: bytes.readInt32LE(20) }
  throw new Error(`Unsupported serialized ObjectID type ${type}`)
}

function array(reader: Reader, type: string): SparseArray {
  const elementSize = reader.u32(), count = reader.u32()
  reader.u32() // Historical in-memory bitset ID; the actual bitset follows data.
  const expectedSize = type === 'ah' ? 24 : Number(type.slice(1))
  if (elementSize !== expectedSize || count > MAX_ARRAY_COUNT) throw new Error('Invalid MOB/PRO array size or count')
  const payload = reader.bytes(elementSize * count)
  const wordCount = reader.u32()
  if (wordCount > MAX_BITSET_WORDS) throw new Error('MOB/PRO sparse bitset is too large')
  const words = reader.bytes(wordCount * 4)
  const entries: SparseArray["entries"] = []
  for (let word = 0; word < wordCount; word++) {
    const bits = words.readUInt32LE(word * 4)
    for (let bit = 0; bit < 32; bit++) {
      if (!(bits & (1 << bit))) continue
      if (entries.length >= count) throw new Error('MOB/PRO array count does not match sparse bitset')
      const value = payload.subarray(entries.length * elementSize, (entries.length + 1) * elementSize)
      entries.push({ slot: word * 32 + bit, value: type === 'ah' ? objectId(value) : value.toString('hex') })
    }
  }
  if (entries.length !== count) throw new Error('MOB/PRO array count does not match sparse bitset')
  return { elementSize, entries }
}

function readValue(reader: Reader, type: string): FieldValue {
  if (type === 'i') return reader.bytes(4).readInt32LE()
  if (!reader.presence()) return null
  if (type === 'q') { const bytes = reader.bytes(8); return { low: bytes.readUInt32LE(), high: bytes.readUInt32LE(4) } }
  if (type === 'h') return objectId(reader.bytes(24))
  return array(reader, type)
}

function parseRecord(input: ByteInput, prototype = false): ParsedRecord {
  const reader = new Reader(input)
  if (reader.u32() !== 0x77) throw new Error('Unsupported MOB/PRO file version')
  const first = objectId(reader.bytes(24), { blocked: prototype })
  const second = objectId(reader.bytes(24))
  const definition = TYPES.get(reader.u32())
  if (!definition) throw new Error('Unsupported MOB/PRO object type')
  if (prototype ? first.kind !== 'blocked' || second.kind !== 'prototype' || !second.id
    : first.kind !== 'prototype' || !first.id || second.kind !== 'guid') throw new Error('Invalid MOB/PRO object header IDs')
  const count = prototype ? null : reader.bytes(2).readUInt16LE()
  const flags = definition.sections.map(section => {
    const words = Array.from({ length: Math.ceil(section.length / 32) }, () => reader.u32())
    if (!prototype) {
      const used = section.length % 32
      if (used && (words.at(-1)! >>> used)) throw new Error('Unknown overridden MOB field bits')
    }
    return words
  })
  const fields: Record<string, FieldValue> = {}
  for (let index = 0; index < definition.sections.length; index++) {
    definition.sections[index].forEach(([name, type], bit) => {
      if (prototype || flags[index][Math.floor(bit / 32)] & (1 << (bit % 32))) fields[name] = readValue(reader, type)
    })
  }
  if (!prototype && Object.keys(fields).length !== count) throw new Error('MOB overridden field count mismatch')
  if (reader.offset !== reader.buffer.length) throw new Error('Trailing bytes after MOB/PRO fields')
  return { id: (second as {id: string | number}).id, prototype: (prototype ? (second as {id: number}).id : (first as {id: number}).id),
    type: definition.name, definition, fields }
}

const parseMobile = (input: ByteInput): MobileRecord => parseRecord(input, false) as MobileRecord
const parsePrototype = (input: ByteInput): PrototypeRecord => parseRecord(input, true) as PrototypeRecord
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function mapName(mapId: string) {
  if (typeof mapId !== 'string' || !mapId || /[/\\\x00-\x1f]/.test(mapId) || mapId === '.' || mapId === '..') {
    throw new Error('Invalid map ID')
  }
}

function correlate(record: ParsedRecord, converted: unknown): asserts converted is ConvertedRecord {
  if (!plain(converted) || !plain(converted.Base) || converted.Base.type !== record.type ||
      converted.Base.prototype !== record.prototype) throw new Error(`Converted type/prototype mismatch for ${record.id}`)
}

function buildOwnership(records: OwnershipRecord[]): Map<string, {id: string; slot: number}[]> {
  const byId = new Map<string, OwnershipRecord>(), membership = new Map<string, string>(), owned = new Map<string, {id: string; slot: number}[]>()
  for (const record of records) {
    if (byId.has(record.id)) throw new Error(`Duplicate original MOB ID ${record.id}`)
    byId.set(record.id, record)
  }
  for (const record of records) {
    if (!record.definition.owner) continue
    const prefix = record.definition.prefix, fields = record.effectiveFields
    const count = fields[`${prefix}_INVENTORY_NUM`] as number
    const inventory = (fields[`${prefix}_INVENTORY_LIST_IDX`] as SparseArray | null)?.entries || []
    if (!Number.isInteger(count) || count < 0 || count !== inventory!.length) throw new Error(`Inventory count mismatch for ${record.id}`)
    const slots = new Set()
    const rows = inventory.map(({ slot, value }) => {
      if (!Number.isInteger(slot) || slot < 0 || slots.has(slot)) throw new Error(`Invalid or duplicate inventory sparse slot for ${record.id}`)
      slots.add(slot)
      if (typeof value === 'string' || value.kind !== 'guid') throw new Error(`Inventory entry is not a GUID for ${record.id}`)
      const item = byId.get(value.id)
      if (!item?.definition.item) throw new Error(`Missing or non-item inventory member ${value.id}`)
      if (membership.has(value.id)) throw new Error(`Duplicate inventory membership for ${value.id}`)
      membership.set(value.id, record.id)
      return { id: item.convertedEntry, slot }
    })
    owned.set(record.id, rows)
  }
  for (const record of records) {
    if (!record.definition.item) continue
    if (!Number.isInteger(record.effectiveFields.FLAGS)) throw new Error(`Missing original item flags for ${record.id}`)
    const parent = record.effectiveFields.ITEM_PARENT as SerializedId | null
    if (parent === null || parent?.kind === 'null') {
      if (membership.has(record.id) || ((record.effectiveFields.FLAGS as number) & INVENTORY_FLAG)) throw new Error(`Missing item parent for ${record.id}`)
      record.parentPath = null
      continue
    }
    if (parent?.kind !== 'guid' || !byId.get(parent.id)?.definition.owner) throw new Error(`Missing or unsupported item owner for ${record.id}`)
    if (membership.get(record.id) !== parent.id || !((record.effectiveFields.FLAGS as number) & INVENTORY_FLAG)) {
      throw new Error(`Nonreciprocal item ownership for ${record.id}`)
    }
    record.parentPath = byId.get(parent.id)!.convertedEntry
  }
  return owned
}

async function boundedEntry(zip: ArchiveReader, entries: ArchiveEntries, name: string): Promise<Buffer> {
  if (!entries[name] || entries[name].size > MAX_RECORD_BYTES) throw new Error(`Missing or oversized archive record ${name}`)
  const bytes = await zip.entryData(name)
  if (bytes.length > MAX_RECORD_BYTES) throw new Error(`Oversized archive record ${name}`)
  return bytes
}

async function prepareRecovery({ originalArchive, convertedArchive, mapId, dataPath }: RecoveryOptions) {
  mapName(mapId)
  if (typeof dataPath !== 'string' || !dataPath) throw new Error('An explicit local data directory is required for overlay precedence')
  const dataRoot = path.resolve(dataPath)
  const StreamZip = require('node-stream-zip') as typeof import('node-stream-zip')
  const original = new StreamZip.async({ file: originalArchive })
  const converted = new StreamZip.async({ file: convertedArchive })
  try {
    const [originalEntries, convertedEntries] = await Promise.all([original.entries(), converted.entries()])
    const sourcePrefix = `#UNPACKED/Arcanum/maps/${mapId}/`
    const sourceNames = Object.keys(originalEntries).filter(name => name.toLowerCase().startsWith(sourcePrefix.toLowerCase()) &&
      name.slice(sourcePrefix.length).toLowerCase().endsWith('.mob')).sort()
    if (!sourceNames.length) throw new Error(`No original MOB files for ${mapId}`)
    const convertedByGuid = new Map<string, string[]>()
    for (const name of Object.keys(convertedEntries)) {
      if (!name.startsWith(`${mapId}/Sector/`)) continue
      const parts = name.slice(mapId.length + 1).split('/')
      if (parts.length !== 5 || parts[0] !== 'Sector' || !/^(0|[1-9]\d*)$/.test(parts[1]) || !/^(0|[1-9]\d*)$/.test(parts[2]) || !parts[4].endsWith('.json')) continue
      const id = parts[4].replace(/\.json$/, '').toUpperCase()
      if (!GUID.test(id)) continue
      if (!convertedByGuid.has(id)) convertedByGuid.set(id, [])
      convertedByGuid.get(id)!.push(name)
    }
    const prototypes = new Map<number, PrototypeRecord>(), records: RecoveredRecord[] = []
    for (const sourceEntry of sourceNames) {
      const match = sourceEntry.slice(sourcePrefix.length).match(/^G_([0-9A-F]{8})_([0-9A-F]{4})_([0-9A-F]{4})_([0-9A-F]{4})_([0-9A-F]{12})\.mob$/i)
      if (!match) throw new Error(`Unsupported original MOB filename ${sourceEntry}`)
      const source = await boundedEntry(original, originalEntries, sourceEntry)
      const record = parseMobile(source)
      if (match.slice(1).join('-').toUpperCase() !== record.id) throw new Error('MOB filename and header GUID disagree')
      const candidates = (convertedByGuid.get(record.id) || []).filter(name => name.split('/').at(-2) === record.type)
      if (candidates.length !== 1) throw new Error(`Missing or ambiguous converted instance for ${record.id}`)
      const convertedEntry = candidates[0]
      const bytes = await boundedEntry(converted, convertedEntries, convertedEntry)
      let value: unknown
      try { value = JSON.parse(bytes.toString('utf8')) } catch (_) { throw new Error(`Invalid converted JSON ${convertedEntry}`) }
      correlate(record, value)
      if (convertedEntry.split('/').at(-2) !== record.type) throw new Error(`Converted type path mismatch for ${record.id}`)
      let prototype = prototypes.get(record.prototype)
      if (!prototype) {
        const names = Object.keys(originalEntries).filter(name => {
          const match = name.match(/^#UNPACKED\/proto\/(\d+)[^/]*\.pro$/i)
          return match && Number(match[1]) === record.prototype
        })
        if (names.length !== 1) throw new Error(`Missing or ambiguous original prototype ${record.prototype}`)
        const raw = await boundedEntry(original, originalEntries, names[0])
        prototype = parsePrototype(raw)
        if (prototype.id !== record.prototype || prototype.type !== record.type) throw new Error('Original prototype ID/type mismatch')
        prototype.sourceEntry = names[0]
        prototype.sourceSha256 = sha256(raw)
        prototypes.set(prototype.id, prototype)
      }
      if (prototype.id !== record.prototype || prototype.type !== record.type) throw new Error('Original prototype ID/type mismatch')
      const effectiveFields = { ...prototype.fields, ...record.fields }
      const location = effectiveFields.LOCATION as PackedLocation | null
      if (!location || JSON.stringify(value.Base.location) !== JSON.stringify([location.high, location.low])) {
        throw new Error(`Converted original location mismatch for ${record.id}`)
      }
      let overlaySha256
      const loose = path.join(dataRoot, convertedEntry)
      try {
        const stat = await fs.lstat(loose)
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES) throw new Error(`Invalid loose instance overlay ${convertedEntry}`)
        const raw = await fs.readFile(loose)
        try { value = JSON.parse(raw.toString('utf8')) } catch (_) { throw new Error(`Invalid loose instance JSON ${convertedEntry}`) }
        correlate(record, value)
        overlaySha256 = sha256(raw)
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
      correlate(record, value)
      records.push({ ...record, effectiveFields, convertedEntry, converted: value,
        sourceEntry, sourceSha256: sha256(source), convertedSha256: sha256(bytes),
        ...(overlaySha256 ? { overlaySha256 } : {}) })
    }
    const owned = buildOwnership(records)
    const files = [], evidence = [], summary = { records: records.length, containers: 0, npcs: 0,
      items: 0, containerItems: 0, npcItems: 0, groundItems: 0 }
    for (const record of records) {
      const value = record.converted, definition = record.definition
      if (definition.owner) {
        const inventory = owned.get(record.id)
        const component = Object.hasOwn(value, definition.owner) ? value[definition.owner] : {}
        if (!plain(component) || (Object.hasOwn(component, 'inventory') && JSON.stringify(component.inventory) !== JSON.stringify(inventory))) {
          throw new Error(`Existing inventory metadata conflicts for ${record.id}`)
        }
        value[definition.owner] = { ...component, inventory }
        summary[definition.owner === 'Container' ? 'containers' : 'npcs']++
        summary[definition.owner === 'Container' ? 'containerItems' : 'npcItems'] += inventory!.length
      } else {
        const component = Object.hasOwn(value, 'Item') ? value.Item : {}
        if (!plain(component) || (Object.hasOwn(component, 'parent') && component.parent !== record.parentPath)) {
          throw new Error(`Existing item parent conflicts for ${record.id}`)
        }
        value.Item = { ...component, parent: record.parentPath }
        summary.items++
        if (record.parentPath === null) summary.groundItems++
      }
      const contents = `${JSON.stringify(value, null, 2)}\n`
      files.push({ relativePath: record.convertedEntry, contents })
      evidence.push({ guid: record.id, id: record.convertedEntry, type: record.type, prototype: record.prototype,
        sourceEntry: record.sourceEntry, sourceSha256: record.sourceSha256,
        convertedSha256: record.convertedSha256, ...(record.overlaySha256 ? { overlaySha256: record.overlaySha256 } : {}),
        outputSha256: sha256(contents), ...(definition.owner ? {
          inventoryCount: record.effectiveFields[`${definition.prefix}_INVENTORY_NUM`], inventory: owned.get(record.id)
        } : { parent: record.parentPath, inventoryLocation: record.effectiveFields.ITEM_INV_LOCATION }) })
    }
    return { files, manifest: { format: 'openarcanum-inventory-recovery-v1', mapId,
      referenceCommit: 'a7ff41b300ef712f0e7d088183a3d08957110cdd', summary,
      prototypes: [...prototypes.values()].map(value => ({ id: value.id, type: value.type,
        sourceEntry: value.sourceEntry, sourceSha256: value.sourceSha256 })).sort((a, b) => a.id - b.id),
      records: evidence } }
  } finally { await Promise.allSettled([original.close(), converted.close()]) }
}

async function writeRecovery(prepared: OutputFiles, outputDirectory: string) {
  const output = path.resolve(outputDirectory)
  const localData = path.resolve(__dirname, '../../../local-data')
  if (!output.startsWith(localData + path.sep)) throw new Error('Recovery output must be a new directory inside this checkout local-data')
  const destinations = new Set()
  for (const file of prepared.files) {
    const filename = path.resolve(output, file.relativePath)
    if (!filename.startsWith(output + path.sep) || destinations.has(filename) || typeof file.contents !== 'string') {
      throw new Error('Invalid or duplicate inventory recovery output path')
    }
    destinations.add(filename)
  }
  // Reject existing/symlink ancestors before creating anything below them.
  let ancestor = path.dirname(output)
  while (ancestor.startsWith(localData)) {
    try {
      const stat = await fs.lstat(ancestor)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Recovery output ancestor is not a regular directory')
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if (ancestor === localData) break
    ancestor = path.dirname(ancestor)
  }
  try { await fs.lstat(output); throw new Error('Recovery output already exists') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  await fs.mkdir(path.dirname(output), { recursive: true })
  const temporary = await fs.mkdtemp(path.join(path.dirname(output), '.inventory-recovery-'))
  try {
    for (const file of prepared.files) {
      const filename = path.join(temporary, file.relativePath)
      await fs.mkdir(path.dirname(filename), { recursive: true })
      await fs.writeFile(filename, file.contents, { flag: 'wx', mode: 0o600 })
    }
    await fs.writeFile(path.join(temporary, 'recovery-manifest.json'), `${JSON.stringify(prepared.manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    try { await fs.lstat(output); throw new Error('Recovery output already exists') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    await fs.rename(temporary, output)
  } catch (error) { await fs.rm(temporary, { recursive: true, force: true }); throw error }
}

async function main(argv: string[]) {
  const options: CliOptions = {}
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (['--original', '--converted', '--data', '--map', '--output'].includes(argument)) {
      if (!argv[index + 1] || argv[index + 1].startsWith('--') || Object.hasOwn(options, argument.slice(2))) throw new Error(`Missing or duplicate value for ${argument}`)
      Reflect.set(options, argument.slice(2), argv[++index])
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.original || !options.converted || !options.data || !options.map || (!options.dryRun && !options.output)) {
    throw new Error('Usage: node recover-inventories.cts --original ORIGINAL.zip --converted MAP.zip --data DATA_DIR --map "Map Name" [--dry-run | --output local-data/NEW-OVERLAY]')
  }
  const prepared = await prepareRecovery({ originalArchive: options.original, convertedArchive: options.converted,
    dataPath: options.data, mapId: options.map })
  if (!options.dryRun) await writeRecovery(prepared, options.output!)
  console.info(JSON.stringify({ dryRun: Boolean(options.dryRun), mapId: prepared.manifest.mapId,
    ...prepared.manifest.summary, ...(options.output ? { output: path.resolve(options.output) } : {}) }, null, 2))
}

module.exports = { parseMobile, parsePrototype, buildOwnership, prepareRecovery, writeRecovery }
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
