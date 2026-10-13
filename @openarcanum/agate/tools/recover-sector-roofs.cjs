'use strict'

// Local recovery of the original SEC roof/light records that the legacy C++
// converter lost. No game files are bundled with this tool. SEC layouts and
// ART ID fields follow arcanum-ce sector_roof_list.c, light.c and tig/art.c.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOF_SIZE = 16
const DIRECTIONS = ['North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest']

function requireBytes(buffer, offset, length, description) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
      offset + length > buffer.length) throw new Error(`Truncated SEC ${description}`)
}

function parseMesNames(input) {
  const text = typeof input === 'string' ? input : new TextDecoder('windows-1252').decode(input)
  const result = new Map()
  for (const match of text.replace(/\/\/[^\r\n]*/g, '').matchAll(/\{(\d+)\}\s*\{([^{}]+)\}/g)) {
    const id = Number(match[1])
    const name = match[2].trim().replace(/\.art$/i, '')
    if (!name || /[/\\]/.test(name) || name === '.' || name === '..') throw new Error(`Invalid MES art name at ${id}`)
    if (result.has(id)) throw new Error(`Duplicate MES record ${id}`)
    result.set(id, name)
  }
  if (!result.size) throw new Error('MES contains no art names')
  return result
}

function parseConstantLighting(mapInfo, schemeNames, schemeColors) {
  const info = typeof mapInfo === 'string' ? mapInfo : new TextDecoder('windows-1252').decode(mapInfo)
  const match = info.match(/(?:^|[\r\n])\s*LightScheme\s*:\s*(\d+)/i)
  if (!match) throw new Error('Map info has no explicit LightScheme')
  const scheme = Number(match[1])
  const schemeName = nameAt(schemeNames, scheme, 'lighting scheme')
  const text = typeof schemeColors === 'string' ? schemeColors : new TextDecoder('windows-1252').decode(schemeColors)
  const hours = new Map()
  for (const record of text.replace(/\/\/[^\r\n]*/g, '').matchAll(/\{(\d+)\}\s*\{([^{}]*)\}/g)) {
    const hour = Number(record[1])
    if (hour > 23 || hours.has(hour)) throw new Error(`Invalid lighting scheme hour ${hour}`)
    const value = record[2].trim()
    const rgb = value ? value.split(',').map(component => Number(component.trim())) : null
    if (rgb && (rgb.length !== 6 || rgb.some(component => !Number.isInteger(component) || component < 0 || component > 255))) {
      throw new Error(`Invalid lighting colors at hour ${hour}`)
    }
    hours.set(hour, rgb)
  }
  if (hours.size !== 24 || !hours.get(0) || !hours.get(23)) throw new Error('Lighting scheme needs all24 hours and explicit endpoints')
  const first = hours.get(0)
  for (const colors of hours.values()) {
    if (colors && colors.some((component, index) => component !== first[index])) {
      throw new Error('Variable ambient lighting schemes are not supported by this recovery helper')
    }
  }
  // All specified colors are identical, so original interpolation of the empty
  // hours is exactly constant. No guessed time curve or fallback color.
  return { schemeName, lighting: { scheme, hour: 12, constant: true,
    indoor: first.slice(3), outdoor: first.slice(0, 3) } }
}

function inspectRoofArt(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  requireBytes(buffer, 0, 132, 'roof ART header')
  const flags = buffer.readUInt32LE(0)
  if (!(flags & 1)) throw new Error('Rotating roof ART is not supported by this recovery helper')
  const frameCount = buffer.readUInt32LE(32)
  const paletteSlots = Array.from({ length: 4 }, (_, index) => index)
    .filter(index => buffer.readUInt32LE(12 + index * 4) !== 0)
  if (!paletteSlots.includes(0)) throw new Error('Roof ART has no primary palette')
  const framesOffset = 132 + paletteSlots.length * 1024
  requireBytes(buffer, framesOffset, frameCount * 28, 'roof ART frame headers')
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const offset = framesOffset + index * 28
    return { width: buffer.readUInt32LE(offset), height: buffer.readUInt32LE(offset + 4),
      hotspot: { x: buffer.readInt32LE(offset + 12), y: buffer.readInt32LE(offset + 16) } }
  })
  return { flags, frameCount, paletteSlots, frames }
}

function nameAt(names, index, type) {
  const name = names instanceof Map ? names.get(index) : names[index]
  if (!name) throw new Error(`Missing ${type} MES name ${index}`)
  return name
}

function decodeRoofId(rawId, roofNames) {
  if (rawId === 0xffffffff) return null
  if ((rawId >>> 28) !== 10) throw new Error(`Unexpected roof ART type: 0x${rawId.toString(16)}`)
  const frame = (rawId >>> 14) & 31
  const flipped = Boolean(rawId & 1)
  return {
    resource: { type: 'Roof', name: nameAt(roofNames, (rawId >>> 19) & 511, 'roof'),
      frame, variant: (rawId >>> 4) & 3, flipped },
    rawId,
    fill: Boolean((rawId >>> 13) & 1),
    fade: Boolean((rawId >>> 12) & 1),
    piece: frame + (flipped ? 9 : 0)
  }
}

function decodeLightId(rawId, lightNames) {
  if ((rawId >>> 28) !== 9) throw new Error(`Unexpected light ART type: 0x${rawId.toString(16)}`)
  return { type: 'Light', name: nameAt(lightNames, (rawId >>> 19) & 511, 'light'),
    frame: (rawId >>> 12) & 127, stage: DIRECTIONS[(rawId >>> 9) & 7],
    index: (rawId >>> 4) & 31, shadow: Boolean(rawId & 1) }
}

function parseSectorRoofData(input, roofNames, { lightNames } = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  requireBytes(buffer, 0, 4, 'light count')
  const lightCount = buffer.readUInt32LE(0)
  const lightBytes = lightCount * 48
  requireBytes(buffer, 4, lightBytes + 4096 * 4 + 4, 'lights, tiles and roof marker')
  const lights = []
  if (lightNames) {
    for (let index = 0; index < lightCount; index++) {
      const offset = 4 + index * 48
      const rawId = buffer.readUInt32LE(offset + 28)
      // Original packed locations are low32=x, high32=y. Match the legacy
      // entity runtime axes [originalY, originalX]; screen offsets stay pixels.
      const rgb = [buffer[offset + 32], buffer[offset + 34], buffer[offset + 33]]
      lights.push({ resource: decodeLightId(rawId, lightNames), rawId,
        location: [buffer.readUInt32LE(offset + 12), buffer.readUInt32LE(offset + 8)],
        offset: [buffer.readInt32LE(offset + 16), buffer.readInt32LE(offset + 20)],
        flags: buffer.readUInt32LE(offset + 24), rgb,
        color: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`,
        tintColor: buffer.readUInt32LE(offset + 36), palette: buffer.readInt32LE(offset + 40),
        objectId: buffer.readBigUInt64LE(offset).toString() })
    }
  }
  const markerOffset = 4 + lightBytes + 4096 * 4
  const marker = buffer.readUInt32LE(markerOffset)
  if (marker !== 0 && marker !== 1) throw new Error(`Invalid SEC roof empty marker ${marker}`)
  const tableOffset = markerOffset + 4
  const roofBytes = marker === 0 ? ROOF_SIZE * ROOF_SIZE * 4 : 0
  requireBytes(buffer, tableOffset, roofBytes + 4, 'roof table and following section marker')
  const sectionMarker = buffer.readUInt32LE(tableOffset + roofBytes)
  if (sectionMarker < 0xaa0000 || sectionMarker > 0xaa0004) {
    throw new Error(`Invalid section marker after SEC roofs: 0x${sectionMarker.toString(16)}`)
  }
  let validRoofCount = 0
  const pieceCounts = {}
  // Preserve every original y/x cell, including null sentinels. Sector.load
  // performs the runtime transpose once, just as it does for the ground grid.
  const roof = Array.from({ length: ROOF_SIZE }, (_, y) =>
    Array.from({ length: ROOF_SIZE }, (_, x) => {
      if (marker === 1) return null
      const value = decodeRoofId(buffer.readUInt32LE(tableOffset + (y * ROOF_SIZE + x) * 4), roofNames)
      if (value) {
        validRoofCount++
        pieceCounts[value.piece] = (pieceCounts[value.piece] || 0) + 1
      }
      return value
    }))
  return { roof, lights, lightCount, validRoofCount, pieceCounts,
    markerOffset, tableOffset: marker === 0 ? tableOffset : null, sectionMarker }
}

function uniqueEntry(entries, wanted) {
  if (Object.hasOwn(entries, wanted)) return wanted
  const matches = Object.keys(entries).filter(name => name.toLowerCase() === wanted.toLowerCase())
  if (matches.length !== 1) throw new Error(matches.length
    ? `Ambiguous archive path: ${wanted}` : `Missing archive entry: ${wanted}`)
  return matches[0]
}

function decodeSectorId(filename) {
  const match = filename.match(/(?:^|\/)(\d+)\.sec$/i)
  if (!match) throw new Error(`Invalid SEC filename: ${filename}`)
  const id = BigInt(match[1])
  if (id >> 52n) throw new Error(`SEC coordinates out of range: ${filename}`)
  const originalX = Number(id & 0x3ffffffn)
  const originalY = Number((id >> 26n) & 0x3ffffffn)
  return { originalX, originalY, runtimeX: originalY, runtimeY: originalX }
}

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex')

async function prepareRecovery({ originalArchive, convertedArchive, gfxArchive, mapId, includeLights = false }) {
  if (!mapId || /[/\\]/.test(mapId) || mapId === '.' || mapId === '..') throw new Error('Invalid map ID')
  // Resolve this tool's declared AGate dependency, avoiding a second ZIP parser.
  const StreamZip = require('node-stream-zip')
  const originals = new StreamZip.async({ file: originalArchive })
  const converted = new StreamZip.async({ file: convertedArchive })
  const gfx = new StreamZip.async({ file: gfxArchive })
  try {
    const [originalEntries, convertedEntries, gfxEntries] = await Promise.all([
      originals.entries(), converted.entries(), gfx.entries()])
    const roofMesEntry = uniqueEntry(originalEntries, '#UNPACKED/art/roof/roofname.mes')
    const roofMes = await originals.entryData(roofMesEntry)
    const roofNames = parseMesNames(roofMes)
    const lightMesEntry = includeLights ? uniqueEntry(originalEntries, '#UNPACKED/art/light/light.mes') : null
    const lightMes = includeLights ? await originals.entryData(lightMesEntry) : null
    const lightNames = includeLights ? parseMesNames(lightMes) : undefined
    const sourcePrefix = `#UNPACKED/Arcanum/maps/${mapId}/`
    const sectorEntries = Object.keys(originalEntries).filter(name =>
      name.toLowerCase().startsWith(sourcePrefix.toLowerCase()) && /^\d+\.sec$/i.test(name.slice(sourcePrefix.length))).sort()
    if (!sectorEntries.length) throw new Error(`No original SEC files for ${mapId}`)
    const mapEntry = uniqueEntry(convertedEntries, `${mapId}/Map.json`)
    const mapData = await converted.entryData(mapEntry)
    const mapMeta = JSON.parse(mapData.toString('utf8'))
    if (!Number.isInteger(mapMeta.width) || !Number.isInteger(mapMeta.height) || mapMeta.width < 1 || mapMeta.height < 1) {
      throw new Error('Invalid converted map dimensions')
    }
    const files = []
    const atlasFrames = new Map()
    const sourceArts = new Map()
    const sectors = []
    let lighting
    let lightingSources
    if (includeLights) {
      const mapInfoEntry = uniqueEntry(originalEntries, `${sourcePrefix}mapinfo.txt`)
      const mapInfo = await originals.entryData(mapInfoEntry)
      // The retained source archive has module-template Rules. Prefer the
      // actual module's Rules whenever present, and record any template source.
      const moduleRules = '#UNPACKED/Arcanum/Rules/'
      const templateRules = '#UNPACKED/Module template/Rules/'
      const schemesWanted = `${moduleRules}Lighting Schemes.mes`
      const rulesPrefix = Object.keys(originalEntries).some(name => name.toLowerCase() === schemesWanted.toLowerCase())
        ? moduleRules : templateRules
      const schemesEntry = uniqueEntry(originalEntries, `${rulesPrefix}Lighting Schemes.mes`)
      const schemes = await originals.entryData(schemesEntry)
      const schemeNames = parseMesNames(schemes)
      const schemeMatch = mapInfo.toString('latin1').match(/(?:^|[\r\n])\s*LightScheme\s*:\s*(\d+)/i)
      if (!schemeMatch) throw new Error('Map info has no explicit LightScheme')
      const schemeName = nameAt(schemeNames, Number(schemeMatch[1]), 'lighting scheme')
      const colorsEntry = uniqueEntry(originalEntries, `${rulesPrefix}${schemeName}.mes`)
      const colors = await originals.entryData(colorsEntry)
      lighting = parseConstantLighting(mapInfo, schemeNames, colors).lighting
      lightingSources = [{ entry: mapInfoEntry, sha256: sha256(mapInfo) },
        { entry: schemesEntry, sha256: sha256(schemes) }, { entry: colorsEntry, sha256: sha256(colors) }]
      files.push({ relativePath: `${mapId}/Map.json`,
        contents: JSON.stringify({ ...mapMeta, lighting }, null, 2) + '\n' })
    }
    async function validateResource(resource) {
      // Atlas folder casing is significant. Use its actual canonical name;
      // tolerate MES casing only when the fallback match is unambiguous.
      const stageEntry = uniqueEntry(gfxEntries, `Gfx/2D/${resource.type}/${resource.name}/0/${resource.stage || 'North'}/Stage.json`)
      resource.name = stageEntry.split('/')[3]
      const frameKey = `${resource.type}/${resource.name}/0/${resource.stage || 'North'}/${resource.frame}`
      let stage = atlasFrames.get(stageEntry)
      if (!stage) {
        stage = JSON.parse((await gfx.entryData(stageEntry)).toString('utf8'))
        atlasFrames.set(stageEntry, stage)
      }
      const frame = stage.frames?.[frameKey]
      if (!frame || !Number.isInteger(frame.frame?.w) || !Number.isInteger(frame.frame?.h)) {
        throw new Error(`Missing converted atlas frame: ${frameKey}`)
      }
      uniqueEntry(gfxEntries, stageEntry.replace(/Stage\.json$/, 'Sprite.gif'))
      return { key: frameKey, width: frame.frame.w, height: frame.frame.h,
        hotspot: frame.center || { x: 0, y: 0 } }
    }
    for (const originalEntry of sectorEntries) {
      const coords = decodeSectorId(originalEntry)
      if (coords.originalX >= mapMeta.width || coords.originalY >= mapMeta.height) {
        throw new Error(`Original SEC outside converted map bounds: ${originalEntry}`)
      }
      const convertedEntry = uniqueEntry(convertedEntries,
        `${mapId}/Sector/${coords.runtimeX}/${coords.runtimeY}/Sector.json`)
      const [raw, existing] = await Promise.all([originals.entryData(originalEntry), converted.entryData(convertedEntry)])
      const recovered = parseSectorRoofData(raw, roofNames, { lightNames })
      const sectorData = JSON.parse(existing.toString('utf8'))
      if (!Array.isArray(sectorData.tiles)) throw new Error(`Invalid converted sector: ${convertedEntry}`)
      const cells = []
      for (let y = 0; y < ROOF_SIZE; y++) {
        for (let x = 0; x < ROOF_SIZE; x++) {
          const cell = recovered.roof[y][x]
          if (!cell) continue
          const atlas = await validateResource(cell.resource)
          const artEntry = uniqueEntry(originalEntries, `#UNPACKED/art/roof/${cell.resource.name}.art`)
          if (!sourceArts.has(artEntry)) {
            const art = await originals.entryData(artEntry)
            sourceArts.set(artEntry, { entry: artEntry, sha256: sha256(art), ...inspectRoofArt(art) })
          }
          const sourceFrame = sourceArts.get(artEntry).frames[cell.resource.frame]
          if (!sourceFrame || sourceFrame.width !== atlas.width || sourceFrame.height !== atlas.height ||
              sourceFrame.hotspot.x !== atlas.hotspot.x || sourceFrame.hotspot.y !== atlas.hotspot.y) {
            throw new Error(`Converted roof atlas metadata differs from original ART: ${atlas.key}`)
          }
          cells.push({ originalCell: [x, y], runtimeCell: [y, x],
            runtimeGroundCenter: [coords.runtimeX * 64 + y * 4 + 2, coords.runtimeY * 64 + x * 4 + 2],
            rawId: cell.rawId, piece: cell.piece, fill: cell.fill, fade: cell.fade, atlas })
        }
      }
      if (includeLights) {
        for (const light of recovered.lights) light.atlas = await validateResource(light.resource)
        sectorData.lights = recovered.lights
      }
      delete sectorData.roofs
      sectorData.roof = recovered.roof
      files.push({ relativePath: `${mapId}/Sector/${coords.runtimeX}/${coords.runtimeY}/Sector.json`,
        contents: JSON.stringify(sectorData, null, 2) + '\n' })
      sectors.push({ ...coords, originalEntry, sourceSha256: sha256(raw),
        convertedSha256: sha256(existing), markerOffset: recovered.markerOffset,
        tableOffset: recovered.tableOffset, roofCount: recovered.validRoofCount,
        pieceCounts: recovered.pieceCounts, cells,
        ...(includeLights ? { lights: recovered.lights } : { lightCount: recovered.lightCount }) })
    }
    const manifest = { format: 'openarcanum-sector-recovery-v1', mapId,
      coordinateConvention: 'roof rows are originalY/columns originalX; runtime Sector.load transposes once',
      sourceNames: { roof: { entry: roofMesEntry, sha256: sha256(roofMes) },
        ...(includeLights ? { light: { entry: lightMesEntry, sha256: sha256(lightMes) } } : {}) },
      ...(includeLights ? { lighting, lightingSources } : {}),
      roofCount: sectors.reduce((count, sector) => count + sector.roofCount, 0),
      lightCount: sectors.reduce((count, sector) => count + (sector.lights?.length ?? sector.lightCount), 0),
      originalRoofArts: [...sourceArts.values()], sectors }
    return { files, manifest }
  } finally {
    await Promise.allSettled([originals.close(), converted.close(), gfx.close()])
  }
}

async function writeRecovery(prepared, outputDirectory) {
  // The entire input and atlas set is validated before this function is called.
  // Outputs are separate loose-file overlays; source archives are never edited.
  const output = path.resolve(outputDirectory)
  const localData = path.resolve(__dirname, '../../../local-data')
  if (!output.startsWith(localData + path.sep)) throw new Error('Recovery output must be a new directory inside this checkout local-data')
  const destinations = new Set()
  for (const file of prepared.files) {
    const filename = path.resolve(output, file.relativePath)
    if (!filename.startsWith(output + path.sep) || destinations.has(filename)) throw new Error('Invalid or duplicate recovery output path')
    destinations.add(filename)
  }
  try {
    await fs.access(output)
    throw new Error(`Recovery output already exists: ${output}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const parent = path.dirname(output)
  await fs.mkdir(parent, { recursive: true })
  const temporary = await fs.mkdtemp(path.join(parent, '.sector-recovery-'))
  try {
    for (const file of prepared.files) {
      const filename = path.join(temporary, file.relativePath)
      await fs.mkdir(path.dirname(filename), { recursive: true })
      await fs.writeFile(filename, file.contents, { flag: 'wx' })
    }
    await fs.writeFile(path.join(temporary, 'recovery-manifest.json'), JSON.stringify(prepared.manifest, null, 2) + '\n', { flag: 'wx' })
    await fs.rename(temporary, output)
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true })
    throw error
  }
}

async function main(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--include-lights') options.includeLights = true
    else if (argument === '--dry-run') options.dryRun = true
    else if (['--original', '--converted', '--gfx', '--map', '--output'].includes(argument)) {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`Missing value for ${argument}`)
      options[argument.slice(2)] = argv[++index]
    } else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.original || !options.converted || !options.gfx || !options.map || (!options.dryRun && !options.output)) {
    throw new Error('Usage: node recover-sector-roofs.cjs --original ORIGINAL.zip --converted MAP.zip --gfx Gfx.zip --map "Map Name" [--include-lights] [--dry-run | --output local-data/NEW-OVERLAY]')
  }
  const prepared = await prepareRecovery({ originalArchive: options.original, convertedArchive: options.converted,
    gfxArchive: options.gfx, mapId: options.map, includeLights: options.includeLights })
  if (!options.dryRun) await writeRecovery(prepared, options.output)
  console.info(JSON.stringify({ dryRun: Boolean(options.dryRun), mapId: prepared.manifest.mapId,
    sectors: prepared.manifest.sectors.length, roofCount: prepared.manifest.roofCount,
    lightCount: prepared.manifest.lightCount, ...(options.output ? { output: path.resolve(options.output) } : {}) }, null, 2))
}

module.exports = { parseMesNames, parseConstantLighting, inspectRoofArt, decodeRoofId, decodeLightId, parseSectorRoofData,
  decodeSectorId, uniqueEntry, prepareRecovery, writeRecovery }

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
