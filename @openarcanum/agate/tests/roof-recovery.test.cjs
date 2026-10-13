const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const recovery = require('../tools/recover-sector-roofs.cjs')

const roofNames = new Map([[11, 'SyntheticRoof']])
const lightNames = new Map([[3, 'SyntheticLight']])
const roofId = ({ frame = 0, flipped = false, palette = 0, fill = false, fade = false } = {}) =>
  ((10 << 28) | (11 << 19) | (frame << 14) | (Number(fill) << 13) |
    (Number(fade) << 12) | (palette << 4) | Number(flipped)) >>> 0

function makeSector({ hasRoof = true, lights = true } = {}) {
  const count = lights ? 1 : 0
  const tableStart = 4 + count * 48 + 4096 * 4 + 4
  const roofBytes = hasRoof ? 256 * 4 : 0
  const buffer = Buffer.alloc(tableStart + roofBytes + 4)
  buffer.writeUInt32LE(count, 0)
  if (lights) {
    const light = 4
    buffer.writeBigUInt64LE(123n, light)
    buffer.writeUInt32LE(66, light + 8) // original x
    buffer.writeUInt32LE(137, light + 12) // original y
    buffer.writeInt32LE(-3, light + 16)
    buffer.writeInt32LE(17, light + 20)
    buffer.writeUInt32LE(5, light + 24)
    buffer.writeUInt32LE(((9 << 28) | (3 << 19) | (7 << 12) | (6 << 9) | (12 << 4) | 1) >>> 0, light + 28)
    buffer[light + 32] = 14 // r,b,g original byte order
    buffer[light + 33] = 82
    buffer[light + 34] = 250
    buffer.writeUInt32LE(0x112233, light + 36)
    buffer.writeInt32LE(27, light + 40)
  }
  buffer.writeUInt32LE(hasRoof ? 0 : 1, tableStart - 4)
  if (hasRoof) {
    buffer.fill(255, tableStart, tableStart + roofBytes)
    buffer.writeUInt32LE(roofId({ frame: 1, flipped: true, palette: 1, fade: true }), tableStart + (2 * 16 + 7) * 4)
    buffer.writeUInt32LE(roofId({ frame: 8, fill: true }), tableStart + (9 * 16 + 3) * 4)
  }
  buffer.writeUInt32LE(0xaa0004, tableStart + roofBytes)
  return { buffer, tableStart }
}

test('SEC recovery preserves original roof cells, sentinel gaps, piece flags and actual light channels', () => {
  const { buffer, tableStart } = makeSector()
  const before = Buffer.from(buffer)
  const result = recovery.parseSectorRoofData(buffer, roofNames, { lightNames })
  assert.equal(result.tableOffset, tableStart)
  assert.equal(result.lightCount, 1)
  assert.equal(result.validRoofCount, 2)
  assert.deepEqual(result.pieceCounts, { 8: 1, 10: 1 })
  assert.equal(result.roof.length, 16)
  assert.ok(result.roof.every(row => row.length === 16))
  assert.equal(result.roof[7][2], null) // no premature runtime transpose
  assert.equal(result.roof[2][6], null) // gaps are not skipped/compacted
  assert.deepEqual(result.roof[2][7], {
    resource: { type: 'Roof', name: 'SyntheticRoof', frame: 1, variant: 1, flipped: true },
    rawId: roofId({ frame: 1, flipped: true, palette: 1, fade: true }),
    piece: 10, fill: false, fade: true
  })
  assert.equal(result.roof[9][3].fill, true)
  assert.deepEqual(result.lights[0], {
    resource: { type: 'Light', name: 'SyntheticLight', frame: 7, stage: 'West', index: 12, shadow: true },
    rawId: ((9 << 28) | (3 << 19) | (7 << 12) | (6 << 9) | (12 << 4) | 1) >>> 0,
    location: [137, 66], offset: [-3, 17], flags: 5, rgb: [14, 250, 82],
    color: 'rgba(14, 250, 82, 1)', tintColor: 0x112233, palette: 27, objectId: '123'
  })
  assert.deepEqual(buffer, before)
})

test('empty SEC roofs do not consume a missing table or invent roof cells', () => {
  const { buffer, tableStart } = makeSector({ hasRoof: false, lights: false })
  const result = recovery.parseSectorRoofData(buffer, roofNames)
  assert.equal(result.tableOffset, null)
  assert.equal(result.markerOffset, tableStart - 4)
  assert.equal(result.validRoofCount, 0)
  assert.equal(result.roof.flat().filter(Boolean).length, 0)
  assert.deepEqual(result.lights, [])
})

test('SEC recovery rejects truncation, invalid roof IDs and misplaced section boundaries', () => {
  const { buffer, tableStart } = makeSector()
  for (const size of [0, 3, 100, tableStart, buffer.length - 1]) {
    assert.throws(() => recovery.parseSectorRoofData(buffer.subarray(0, size), roofNames), /Truncated SEC/)
  }
  const invalidType = Buffer.from(buffer)
  invalidType.writeUInt32LE(0x90000000, tableStart)
  assert.throws(() => recovery.parseSectorRoofData(invalidType, roofNames), /Unexpected roof ART type/)
  const invalidSection = Buffer.from(buffer)
  invalidSection.writeUInt32LE(0, invalidSection.length - 4)
  assert.throws(() => recovery.parseSectorRoofData(invalidSection, roofNames), /section marker/)
  const invalidRoofMarker = Buffer.from(buffer)
  invalidRoofMarker.writeUInt32LE(2, tableStart - 4)
  assert.throws(() => recovery.parseSectorRoofData(invalidRoofMarker, roofNames), /roof empty marker/)
  assert.throws(() => recovery.parseSectorRoofData(buffer, new Map()), /Missing roof MES name/)
})

test('roof ART metadata reads real palette availability and signed hotspots independently of atlas layout', () => {
  const art = Buffer.alloc(132 + 1024 + 2 * 28)
  art.writeUInt32LE(1, 0) // no rotations
  art.writeUInt32LE(8, 4)
  art.writeUInt32LE(8, 8) // legacy rotation count remains8 even without rotations
  art.writeUInt32LE(123456, 12) // only palette0 exists
  art.writeUInt32LE(2, 32)
  for (let frame = 0; frame < 2; frame++) {
    const offset = 132 + 1024 + frame * 28
    art.writeUInt32LE(234 + frame, offset)
    art.writeUInt32LE(140 + frame, offset + 4)
    art.writeInt32LE(-85 + frame, offset + 12)
    art.writeInt32LE(-1, offset + 16)
  }
  assert.deepEqual(recovery.inspectRoofArt(art), { flags: 1, frameCount: 2, paletteSlots: [0],
    frames: [{ width: 234, height: 140, hotspot: { x: -85, y: -1 } },
      { width: 235, height: 141, hotspot: { x: -84, y: -1 } }] })
  assert.throws(() => recovery.inspectRoofArt(art.subarray(0, art.length - 1)), /Truncated/)
})

test('constant ambient recovery requires explicit source scheme and all24 source hours', () => {
  const names = recovery.parseMesNames('// names\n{0}{<map default>}\n{2}{Synthetic Dungeon}')
  const colors = Array.from({ length: 24 }, (_, hour) =>
    `{${hour}}{${hour === 0 || hour === 23 ? '0, 0, 0, 74, 80, 98' : ''}}`).join('\n')
  assert.deepEqual(recovery.parseConstantLighting('LightScheme:2\r\nSoundScheme:1,1', names, colors), {
    schemeName: 'Synthetic Dungeon', lighting: { scheme: 2, hour: 12, constant: true,
      indoor: [74, 80, 98], outdoor: [0, 0, 0] } })
  assert.throws(() => recovery.parseConstantLighting('', names, colors), /explicit LightScheme/)
  assert.throws(() => recovery.parseConstantLighting('LightScheme:2', names, colors.replace('{12}{}', '{12}{1, 0, 0, 74, 80, 98}')), /Variable ambient/)
  assert.throws(() => recovery.parseConstantLighting('LightScheme:2', names, colors.replace('{0}{0, 0, 0, 74, 80, 98}', '{0}{}')), /explicit endpoints/)
  assert.throws(() => recovery.parseMesNames('{1}{first}\n{1}{second}'), /Duplicate/)
})

test('SEC filenames and exact archive casing keep asymmetric sectors distinct', () => {
  assert.deepEqual(recovery.decodeSectorId('map/67108866.sec'),
    { originalX: 2, originalY: 1, runtimeX: 1, runtimeY: 2 })
  const entries = { 'Roof/BR3/Stage.json': {}, 'Roof/Br3/Stage.json': {} }
  assert.equal(recovery.uniqueEntry(entries, 'Roof/Br3/Stage.json'), 'Roof/Br3/Stage.json')
  assert.throws(() => recovery.uniqueEntry(entries, 'Roof/br3/Stage.json'), /Ambiguous/)
})

test('recovery writer refuses output outside ignored local-data without creating files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arcanum-roof-recovery-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const output = path.join(dir, 'output')
  await assert.rejects(recovery.writeRecovery({ files: [], manifest: {} }, output), /inside this checkout local-data/)
  await assert.rejects(fs.access(output), { code: 'ENOENT' })
})
