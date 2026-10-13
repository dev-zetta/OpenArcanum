import {digest} from './BinaryScript.cjs'

export interface OriginalBinding {slot: number; flags: number; counters: number; scriptId: number}
export interface SectorObjectBinding {
  ordinal: number; typeOrdinal: number; sourceOffset: number; sourceLength: number
  prototype: number; type: string; serializedId: string | null
  location: {x: number; y: number} | null
  /** Undefined means inherit prototype; null means explicit empty field. */
  scripts?: OriginalBinding[] | null
}
export interface SectorBindings {
  sourceEntry: string; sourceSha256: string; sector: {x: number; y: number}
  objects: SectorObjectBinding[]; tiles: {ordinal: number; x: number; y: number; flags: number; counters: number; scriptId: number}[]
  sectorScript: {flags: number; counters: number; scriptId: number} | null
}
type Field = readonly [string, string]
const schema = (input: string): Field[] => input.trim().split(/\s+/).map(value => value.split(':') as [string, string])
const base = schema(`CURRENT_AID:i LOCATION:q OFFSET_X:i OFFSET_Y:i SHADOW:i OVERLAY_FORE:a4 OVERLAY_BACK:a4 UNDERLAY:a4
  BLIT_FLAGS:i BLIT_COLOR:i BLIT_ALPHA:i BLIT_SCALE:i LIGHT_FLAGS:i LIGHT_AID:i LIGHT_COLOR:i OVERLAY_LIGHT_FLAGS:a4
  OVERLAY_LIGHT_AID:a4 OVERLAY_LIGHT_COLOR:a4 FLAGS:i SPELL_FLAGS:i BLOCKING_MASK:i NAME:i DESCRIPTION:i AID:i DESTROYED_AID:i
  AC:i HP_PTS:i HP_ADJ:i HP_DAMAGE:i MATERIAL:i RESISTANCE_IDX:a4 SCRIPTS_IDX:a12 SOUND_EFFECT:i CATEGORY:i PAD_IAS_1:a4 PAD_I64AS_1:a8`)
const types = new Map<number, {name: string; fields: Field[]}>([
  [0, {name: 'Wall', fields: schema('WALL_FLAGS:i WALL_PAD_I_1:i WALL_PAD_I_2:i WALL_PAD_IAS_1:a4 WALL_PAD_I64AS_1:a8')}],
  [1, {name: 'Portal', fields: schema('PORTAL_FLAGS:i PORTAL_LOCK_DIFFICULTY:i PORTAL_KEY_ID:i PORTAL_NOTIFY_NPC:i PORTAL_PAD_I_1:i PORTAL_PAD_I_2:i PORTAL_PAD_IAS_1:a4 PORTAL_PAD_I64AS_1:a8')}],
  [2, {name: 'Container', fields: schema('CONTAINER_FLAGS:i CONTAINER_LOCK_DIFFICULTY:i CONTAINER_KEY_ID:i CONTAINER_INVENTORY_NUM:i CONTAINER_INVENTORY_LIST_IDX:ah CONTAINER_INVENTORY_SOURCE:i CONTAINER_NOTIFY_NPC:i CONTAINER_PAD_I_1:i CONTAINER_PAD_I_2:i CONTAINER_PAD_IAS_1:a4 CONTAINER_PAD_I64AS_1:a8')}],
  [3, {name: 'Scenery', fields: schema('SCENERY_FLAGS:i SCENERY_WHOS_IN_ME:h SCENERY_RESPAWN_DELAY:i SCENERY_PAD_I_2:i SCENERY_PAD_IAS_1:a4 SCENERY_PAD_I64AS_1:a8')}],
])
interface SparseEntry {slot: number; bytes: Buffer}
type Value = number | null | {x: number; y: number} | SparseEntry[]
function bindings(value: Value): OriginalBinding[] | null {
  if (value !== null && !Array.isArray(value)) throw new Error('Invalid SEC script array')
  return value?.map(entry => {
    const scriptId = entry.bytes.readInt32LE(8)
    if (entry.slot < 0 || entry.slot >= 36 || scriptId < 0) throw new Error('Invalid SEC script attachment slot/identity')
    return {slot: entry.slot, flags: entry.bytes.readUInt32LE(), counters: entry.bytes.readUInt32LE(4), scriptId}
  }) ?? null
}
class Reader {
  offset = 0
  constructor(readonly bytes: Buffer) {}
  take(size: number): Buffer {
    if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.bytes.length) throw new Error('Truncated SEC data')
    const result = this.bytes.subarray(this.offset, this.offset + size); this.offset += size; return result
  }
  u32(): number {return this.take(4).readUInt32LE()}
  i32(): number {return this.take(4).readInt32LE()}
  value(type: string): Value {
    if (type === 'i') return this.i32()
    const presence = this.take(1)[0]
    if (presence === 0) return null
    if (presence !== 1) throw new Error('Invalid SEC presence marker')
    if (type === 'q') return {x: this.u32(), y: this.u32()}
    if (type === 'h') {this.take(24); return null}
    const size = this.u32(), count = this.u32(); this.u32()
    if (size !== (type === 'ah' ? 24 : Number(type.slice(1))) || count > 65536) throw new Error('Invalid SEC array dimensions')
    const payload = this.take(size * count), words = this.u32(), result: SparseEntry[] = []
    if (words > 4096) throw new Error('SEC array bitset exceeds limit')
    for (let word = 0; word < words; word++) {
      const bits = this.u32()
      for (let bit = 0; bit < 32; bit++) if (bits & (1 << bit)) {
        if (result.length >= count) throw new Error('SEC sparse array count mismatch')
        result.push({slot: word * 32 + bit, bytes: payload.subarray(result.length * size, (result.length + 1) * size)})
      }
    }
    if (result.length !== count) throw new Error('SEC sparse array count mismatch')
    return result
  }
}
function guid(bytes: Buffer): string | null {
  const kind = bytes.readInt16LE(0)
  if (kind === 0) return null
  if (kind !== 2) throw new Error(`Unsupported static SEC object identity type${kind}`)
  const hex = bytes.subarray(8).toString('hex').toUpperCase()
  return `${bytes.readUInt32LE(8).toString(16).padStart(8, '0')}-${bytes.readUInt16LE(12).toString(16).padStart(4, '0')}-${bytes.readUInt16LE(14).toString(16).padStart(4, '0')}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase()
}
/** Sequential, bounded SEC decoder. Primary layouts: arcanum-ce obj.c/obj.h,
 * sector.c, sector_object_list.c, tile_script_list.c, sector_script_list.c.
 * Static objects commonly have null ObjectIDs: never invent a retail GUID. */
export function parseSectorScriptBindings(input: Uint8Array, sourceEntry: string): SectorBindings {
  const bytes = Buffer.from(input)
  if (bytes.length > 8 * 1024 * 1024 || bytes.length < 20) throw new Error('Invalid SEC size')
  const match = sourceEntry.match(/(?:^|\/)(\d+)\.sec$/i)
  if (!match) throw new Error('SEC entry has no numeric sector identity')
  const packed = BigInt(match[1])
  if (packed >> 52n) throw new Error('SEC sector identity exceeds coordinate range')
  const sector = {x: Number(packed & 0x3ffffffn), y: Number((packed >> 26n) & 0x3ffffffn)}
  const reader = new Reader(bytes), lightCount = reader.u32()
  if (lightCount > 65536) throw new Error('SEC light count exceeds limit')
  reader.take(lightCount * 48 + 4096 * 4)
  const roof = reader.u32()
  if (roof !== 0 && roof !== 1) throw new Error('Invalid SEC roof marker')
  if (roof === 0) reader.take(1024)
  const marker = reader.u32()
  if (marker < 0xaa0000 || marker > 0xaa0004) throw new Error('Invalid SEC section marker')
  const tiles: SectorBindings['tiles'] = []
  if (marker >= 0xaa0001) {
    const count = reader.u32()
    if (count > 65536) throw new Error('SEC tile script count exceeds limit')
    for (let ordinal = 0; ordinal < count; ordinal++) {
      reader.u32(); const location = reader.u32(), flags = reader.u32(), counters = reader.u32(), scriptId = reader.i32(); reader.u32()
      const x = location & 63, y = location >>> 6
      if (y > 63) throw new Error('SEC tile script is outside its sector')
      tiles.push({ordinal, x, y, flags, counters, scriptId})
    }
  }
  let sectorScript: SectorBindings['sectorScript'] = null
  if (marker >= 0xaa0002) sectorScript = {flags: reader.u32(), counters: reader.u32(), scriptId: reader.i32()}
  if (marker >= 0xaa0003) reader.take(24)
  if (marker >= 0xaa0004) reader.take(512)
  const count = bytes.readUInt32LE(bytes.length - 4)
  if (count > 65536) throw new Error('SEC object count exceeds limit')
  const objects: SectorObjectBinding[] = [], typeCounts = new Map<string, number>()
  for (let ordinal = 0; ordinal < count; ordinal++) {
    const sourceOffset = reader.offset
    if (reader.u32() !== 0x77) throw new Error('Unsupported SEC object version')
    const prototypeId = reader.take(24)
    if (prototypeId.readInt16LE() !== 1 || !prototypeId.readUInt32LE(8)) throw new Error('Invalid SEC object prototype identity')
    const serializedId = guid(reader.take(24)), definition = types.get(reader.u32()), fieldCount = reader.take(2).readUInt16LE()
    if (!definition) throw new Error(`Unsupported static SEC object type at ordinal${ordinal}`)
    const sections = [base, definition.fields], masks = sections.map(fields => {
      const words = Array.from({length: Math.ceil(fields.length / 32)}, () => reader.u32()), used = fields.length % 32
      if (used && (words.at(-1)! >>> used)) throw new Error('Unknown SEC object override bits')
      return words
    })
    let readCount = 0, location: SectorObjectBinding['location'] = null, scripts: SectorObjectBinding['scripts']
    for (const [index, fields] of sections.entries()) for (const [bit, [name, type]] of fields.entries()) {
      if (!(masks[index][Math.floor(bit / 32)] & (1 << (bit % 32)))) continue
      readCount++; const value = reader.value(type)
      if (name === 'LOCATION') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid SEC object location')
        location = value
      } else if (name === 'SCRIPTS_IDX') {
        scripts = bindings(value)
      }
    }
    if (readCount !== fieldCount) throw new Error('SEC object overridden field count mismatch')
    const typeOrdinal = typeCounts.get(definition.name) || 0; typeCounts.set(definition.name, typeOrdinal + 1)
    objects.push({ordinal, typeOrdinal, sourceOffset, sourceLength: reader.offset - sourceOffset, prototype: prototypeId.readUInt32LE(8),
      type: definition.name, serializedId, location, ...(scripts === undefined ? {} : {scripts})})
  }
  if (reader.offset !== bytes.length - 4 || reader.u32() !== count) throw new Error('SEC object boundary/footer mismatch')
  return {sourceEntry, sourceSha256: digest(bytes), sector, objects, tiles, sectorScript}
}

export interface StaticPrototypeScripts {id: number; type: string; scripts: OriginalBinding[] | null; sourceSha256: string}
/** SEC records may inherit ScriptsIdx. Reading their actual original prototype
 * is mandatory before declaring an omitted override to mean no script. */
export function parseStaticPrototypeScripts(input: Uint8Array): StaticPrototypeScripts {
  const reader = new Reader(Buffer.from(input))
  if (reader.bytes.length > 4 * 1024 * 1024 || reader.u32() !== 0x77 || reader.take(24).readInt16LE() !== -1) throw new Error('Invalid static prototype header')
  const id = reader.take(24), definition = types.get(reader.u32())
  if (id.readInt16LE() !== 1 || !id.readUInt32LE(8) || !definition) throw new Error('Invalid static prototype identity/type')
  const sections = [base, definition.fields]
  for (const fields of sections) reader.take(Math.ceil(fields.length / 32) * 4)
  let scripts: OriginalBinding[] | null = null
  for (const fields of sections) for (const [name, type] of fields) {
    const value = reader.value(type)
    if (name === 'SCRIPTS_IDX') scripts = bindings(value)
  }
  if (reader.offset !== reader.bytes.length) throw new Error('Trailing bytes after static prototype fields')
  return {id: id.readUInt32LE(8), type: definition.name, scripts, sourceSha256: digest(input)}
}

export interface ConvertedStaticIdentity {sourcePath: string; type: string; prototype: number; location: readonly [number, number]}
export interface RecoveredScriptBindings {format: 'openarcanum-script-bindings'; version: 1; objects: Record<string, Record<string, {scriptId: string | null; flags: number; counters: [number, number, number, number]}>>}
export function correlateSectorScriptBindings(sectors: readonly SectorBindings[], converted: readonly ConvertedStaticIdentity[],
    prototypes: ReadonlyMap<number, StaticPrototypeScripts>, mapId: string, namespace = 'arcanum'): {
      bindings: RecoveredScriptBindings; evidence: unknown[]; unmatched: {sourceEntry: string; ordinal: number; type: string; prototype: number}[]
    } {
  if (!mapId || /[/\\\x00-\x1f]/.test(mapId) || !/^[a-z][a-z0-9_-]*$/.test(namespace)) throw new Error('Invalid script binding map/namespace identity')
  const key = (type: string, prototype: number, location: readonly [number, number]) => JSON.stringify([type, prototype, ...location])
  const byIdentity = new Map<string, ConvertedStaticIdentity[]>(), paths = new Set<string>()
  for (const object of converted) {
    if (!object.sourcePath.startsWith(`${mapId}/Sector/`) || paths.has(object.sourcePath) || object.sourcePath.split('/').includes('..') ||
        !Number.isSafeInteger(object.prototype) || object.location.some(value => !Number.isSafeInteger(value))) throw new Error('Invalid converted static object identity')
    paths.add(object.sourcePath)
    const id = key(object.type, object.prototype, object.location)
    byIdentity.set(id, [...(byIdentity.get(id) || []), object])
  }
  const result: RecoveredScriptBindings = {format: 'openarcanum-script-bindings', version: 1, objects: {}}, evidence: unknown[] = [], unmatched: {sourceEntry: string; ordinal: number; type: string; prototype: number}[] = []
  for (const sector of sectors) for (const object of sector.objects) {
    const prototype = prototypes.get(object.prototype)
    if (!prototype || prototype.type !== object.type) throw new Error(`Missing/mismatched original static prototype${object.prototype}`)
    if (!object.location) throw new Error(`Static SEC object${object.ordinal} has no recoverable location`)
    // The original loader rebases low six location bits onto the sector. The
    // legacy converter/runtime reverses original axes exactly once.
    const originalX = sector.sector.x * 64 + (object.location.x & 63), originalY = sector.sector.y * 64 + (object.location.y & 63)
    const matches = byIdentity.get(key(object.type, object.prototype, [originalY, originalX])) || []
    if (matches.length > 1) throw new Error(`Ambiguous converted static object at ${sector.sourceEntry}#${object.ordinal}`)
    if (!matches.length) {unmatched.push({sourceEntry: sector.sourceEntry, ordinal: object.ordinal, type: object.type, prototype: object.prototype}); continue}
    const target = matches[0]
    if (Object.hasOwn(result.objects, target.sourcePath)) throw new Error('Several original static objects correlate to one converted object')
    const original = object.scripts === undefined ? prototype.scripts : object.scripts
    const slots: RecoveredScriptBindings['objects'][string] = {}
    for (const binding of original || []) slots[String(binding.slot)] = {scriptId: binding.scriptId ? `${namespace}:${binding.scriptId}` : null, flags: binding.flags,
      counters: [0, 1, 2, 3].map(index => (binding.counters >>> (index * 8)) & 255) as [number, number, number, number]}
    result.objects[target.sourcePath] = slots
    evidence.push({source: sector.sourceEntry, sourceSha256: sector.sourceSha256, ordinal: object.ordinal,
      sourceOffset: object.sourceOffset, sourceLength: object.sourceLength, prototype: object.prototype,
      prototypeSha256: prototype.sourceSha256, inheritedScripts: object.scripts === undefined, target: target.sourcePath, slots: Object.keys(slots).length})
  }
  return {bindings: result, evidence, unmatched}
}
