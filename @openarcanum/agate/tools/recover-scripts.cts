// SPDX-License-Identifier: GPL-3.0-or-later
// Local-only recovery: proprietary records and recovered bindings stay in local-data.
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const path = require('node:path') as typeof import('node:path')
const crypto = require('node:crypto') as typeof import('node:crypto')
const StreamZip = require('node-stream-zip') as typeof import('node-stream-zip')
const { parseSectorScriptBindings, parseStaticPrototypeScripts, correlateSectorScriptBindings } = require('../../asset-converter/dist/src/scripts/SectorScriptBindings.cjs') as typeof import('../../asset-converter/lib/src/scripts/SectorScriptBindings.cjs')
const { parseMobile, parsePrototype } = require('./recover-inventories.cts') as {
  parseMobile(input: Buffer): RecordData
  parsePrototype(input: Buffer): RecordData
}
interface Sparse { elementSize: number; entries: {slot: number; value: string}[] }
interface RecordData { id: string | number; prototype: number; type: string; fields: Record<string, unknown> }
export interface ScriptBinding { scriptId: string | null; flags: number; counters: [number, number, number, number] }
export interface ScriptBindings { format: 'openarcanum-script-bindings'; version: 1; objects: Record<string, Record<string, ScriptBinding>> }
const hash = (bytes: Buffer | string) => crypto.createHash('sha256').update(bytes).digest('hex')
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function decodeScriptSlots(value: unknown, namespace = 'arcanum'): Record<string, ScriptBinding> {
  if (value === null || value === undefined) return {}
  if (!plain(value) || value.elementSize !== 12 || !Array.isArray(value.entries)) throw new Error('Invalid ScriptsIdx sparse array')
  const slots: Record<string, ScriptBinding> = {}
  for (const entry of (value as unknown as Sparse).entries) {
    if (!Number.isInteger(entry.slot) || entry.slot < 0 || entry.slot >= 36 || Object.hasOwn(slots, entry.slot) ||
      typeof entry.value !== 'string' || !/^[0-9a-f]{24}$/i.test(entry.value)) throw new Error('Invalid or repeated script attachment slot')
    const bytes = Buffer.from(entry.value, 'hex')
    const script = bytes.readInt32LE(8)
    if (script < 0) throw new Error('Invalid negative script attachment')
    slots[entry.slot] = { scriptId: script === 0 ? null : `${namespace}:${script}`, flags: bytes.readUInt32LE(),
      counters: [bytes[4], bytes[5], bytes[6], bytes[7]] }
  }
  return slots
}

async function recoverScripts({ archivePath, prototypeArchive, convertedArchive, dataPath, mapId }: {
  archivePath: string; prototypeArchive: string; convertedArchive: string; dataPath: string; mapId: string
}) {
  if (!mapId || /[/\\\x00-\x1f]/.test(mapId)) throw new Error('Invalid map ID')
  const original = new StreamZip.async({ file: archivePath })
  const prototypes = new StreamZip.async({ file: prototypeArchive })
  const converted = new StreamZip.async({ file: convertedArchive })
  try {
    const [sourceEntries, prototypeEntries, convertedEntries] = await Promise.all([original.entries(), prototypes.entries(), converted.entries()])
    const byGuid = new Map<string, string[]>()
    for (const name of Object.keys(convertedEntries)) {
      if (!name.startsWith(`${mapId}/Sector/`) || !name.endsWith('.json')) continue
      const guid = path.posix.basename(name, '.json').toUpperCase()
      if (!/^[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(guid)) continue
      byGuid.set(guid, [...(byGuid.get(guid) || []), name])
    }
    const bindings: ScriptBindings = { format: 'openarcanum-script-bindings', version: 1, objects: {} }
    const evidence: unknown[] = []
    const cache = new Map<number, RecordData>()
    const prefix = `Arcanum/maps/${mapId}/`
    const names = Object.keys(sourceEntries).filter(name => name.startsWith(prefix) && name.toLowerCase().endsWith('.mob')).sort()
    if (!names.length) throw new Error('No original MOB records for requested map')
    for (const name of names) {
      if (sourceEntries[name].size > 4 * 1024 * 1024) throw new Error('Oversized original mobile')
      const source = await original.entryData(name)
      const mobile = parseMobile(source)
      const candidates = (byGuid.get(String(mobile.id)) || []).filter(entry => entry.split('/').at(-2) === mobile.type)
      if (candidates.length !== 1) throw new Error(`Missing or ambiguous converted object ${mobile.id}`)
      const entry = candidates[0]
      let raw: Buffer
      try { raw = await fs.readFile(path.join(dataPath, entry)) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; raw = await converted.entryData(entry) }
      const object: unknown = JSON.parse(raw.toString('utf8'))
      if (!plain(object) || !plain(object.Base) || object.Base.prototype !== mobile.prototype || object.Base.type !== mobile.type) throw new Error(`Converted identity mismatch: ${entry}`)
      let prototype = cache.get(mobile.prototype)
      if (!prototype) {
        const choices = Object.keys(prototypeEntries).filter(item => {
          const match = item.match(/(?:^|\/)proto\/(\d+)[^/]*\.pro$/i)
          return match && Number(match[1]) === mobile.prototype
        })
        if (choices.length !== 1) throw new Error(`Missing or ambiguous prototype ${mobile.prototype}`)
        if (prototypeEntries[choices[0]].size > 4 * 1024 * 1024) throw new Error('Oversized prototype')
        prototype = parsePrototype(await prototypes.entryData(choices[0]))
        if (prototype.type !== mobile.type || prototype.id !== mobile.prototype) throw new Error('Prototype identity mismatch')
        cache.set(mobile.prototype, prototype)
      }
      const fields = { ...prototype.fields, ...mobile.fields }
      const location = fields.LOCATION
      if (!plain(location) || JSON.stringify(object.Base.location) !== JSON.stringify([location.high, location.low])) throw new Error(`Converted location mismatch: ${entry}`)
      const slots = decodeScriptSlots(fields.SCRIPTS_IDX)
      bindings.objects[entry] = slots
      evidence.push({ source: name, sourceSha256: hash(source), target: entry, targetSha256: hash(raw), prototype: mobile.prototype, slots: Object.keys(slots).length })
    }
    const originalSectors = []
    for (const name of Object.keys(sourceEntries).filter(name => name.startsWith(prefix) && name.toLowerCase().endsWith('.sec')).sort()) {
      if (sourceEntries[name].size > 8 * 1024 * 1024) throw new Error('Oversized original sector')
      const parsed = parseSectorScriptBindings(await original.entryData(name), name)
      originalSectors.push(parsed)
    }
    const staticPrototypes = new Map<number, ReturnType<typeof parseStaticPrototypeScripts>>()
    for (const sector of originalSectors) for (const object of sector.objects) {
      if (staticPrototypes.has(object.prototype)) continue
      const names = Object.keys(prototypeEntries).filter(name => {
        const match = name.match(/(?:^|\/)proto\/(\d+)[^/]*\.pro$/i)
        return match && Number(match[1]) === object.prototype
      })
      if (names.length !== 1) throw new Error(`Missing or ambiguous static prototype ${object.prototype}`)
      staticPrototypes.set(object.prototype, parseStaticPrototypeScripts(await prototypes.entryData(names[0])))
    }
    // Recover every original attachment table, including walls. Correlate only
    // interactive converted objects whose legacy identities are unambiguous.
    const sectors = originalSectors.map(sector => ({ ...sector, objects: sector.objects.filter(object => object.type !== 'Wall') }))
    const originalSectorObjects = originalSectors.flatMap(sector => sector.objects.map(object => {
      const prototype = staticPrototypes.get(object.prototype)!
      if (prototype.type !== object.type) throw new Error(`Static prototype type mismatch: ${object.prototype}`)
      return { source: sector.sourceEntry, sourceSha256: sector.sourceSha256, ordinal: object.ordinal,
        sourceOffset: object.sourceOffset, sourceLength: object.sourceLength, type: object.type,
        prototype: object.prototype, prototypeSha256: prototype.sourceSha256,
        inheritedScripts: object.scripts === undefined, scripts: object.scripts === undefined ? prototype.scripts : object.scripts }
    }))
    const identities: import('../../asset-converter/lib/src/scripts/SectorScriptBindings.cjs').ConvertedStaticIdentity[] = []
    for (const entry of Object.keys(convertedEntries).filter(name => name.startsWith(`${mapId}/Sector/`) && /\/(Portal|Scenery|Container)\/[^/]+\.json$/.test(name))) {
      let raw: Buffer
      try { raw = await fs.readFile(path.join(dataPath, entry)) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; raw = await converted.entryData(entry) }
      const value: unknown = JSON.parse(raw.toString('utf8'))
      if (!plain(value) || !plain(value.Base) || typeof value.Base.prototype !== 'number' || !Array.isArray(value.Base.location) || value.Base.location.length !== 2) throw new Error('Invalid converted static identity')
      identities.push({ sourcePath: entry, type: entry.split('/').at(-2)!, prototype: value.Base.prototype, location: value.Base.location as [number, number] })
    }
    const recovered = correlateSectorScriptBindings(sectors, identities, staticPrototypes, mapId)
    for (const [id, slots] of Object.entries(recovered.bindings.objects)) {
      if (Object.hasOwn(bindings.objects, id) && JSON.stringify(bindings.objects[id]) !== JSON.stringify(slots)) throw new Error(`Conflicting mobile/static attachment recovery: ${id}`)
      bindings.objects[id] = slots
    }
    return { bindings, evidence: { format: 'openarcanum-script-binding-evidence', version: 1, mapId,
      records: evidence, staticRecords: recovered.evidence, originalSectorObjects, unmatched: recovered.unmatched,
      tileScripts: sectors.flatMap(sector => sector.tiles.map(tile => ({ source: sector.sourceEntry, ...tile }))),
      sectorScripts: sectors.filter(sector => sector.sectorScript !== null).map(sector => ({ source: sector.sourceEntry, script: sector.sectorScript })),
      inactiveEvents: ['scenery-use', 'tile', 'sector', 'dialog', 'combat'] } }
  } finally { await Promise.allSettled([original.close(), prototypes.close(), converted.close()]) }
}

async function protectedWrite(filename: string, content: string) {
  await fs.mkdir(path.dirname(filename), { recursive: true })
  try { await fs.writeFile(filename, content, { flag: 'wx' }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (await fs.readFile(filename, 'utf8') === content) return
    const candidate = `${filename}.${hash(content).slice(0, 12)}.candidate`
    await fs.writeFile(candidate, content, { flag: 'wx' }).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error })
    throw new Error(`Existing edited recovery was preserved; candidate: ${candidate}`)
  }
}
async function main() {
  const { parseArgs } = require('node:util') as typeof import('node:util')
  const { values } = parseArgs({ options: { archive: { type: 'string' }, prototypes: { type: 'string' }, converted: { type: 'string' }, data: { type: 'string' }, map: { type: 'string' } } })
  if (!values.archive || !values.prototypes || !values.converted || !values.data || !values.map) throw new Error('Usage: node recover-scripts.cts --archive INPUT.zip --prototypes PROTOTYPES.zip --converted MAP.zip --data local-data --map NAME')
  const dataPath = path.resolve(values.data)
  const localData = path.resolve(__dirname, '../../../local-data')
  if (dataPath !== localData && !dataPath.startsWith(localData + path.sep)) throw new Error('Recovery output must stay under local-data')
  const result = await recoverScripts({ archivePath: values.archive, prototypeArchive: values.prototypes, convertedArchive: values.converted, dataPath, mapId: values.map })
  await protectedWrite(path.join(dataPath, 'rules', 'ScriptBindings.json'), JSON.stringify(result.bindings, null, 2) + '\n')
  await protectedWrite(path.join(dataPath, 'script-binding-evidence.json'), JSON.stringify(result.evidence, null, 2) + '\n')
  console.info(`Recovered ${Object.keys(result.bindings.objects).length} correlated object attachment tables`)
}
module.exports = { decodeScriptSlots, recoverScripts }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
