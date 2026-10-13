const { mutableFixture } = require('./fixture-types.cts') as { mutableFixture: import('./fixture-types.cjs').MutableFixtureFactory }
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')

let LightLayer, lightWorldPosition, lightRGB

before(async () => {
  const root = path.resolve(__dirname, '../../..')
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root,
    entryPoints: [path.join(root, '@openarcanum/agate/src/client/LightLayer.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    write: false
  })
  const compiled = new Module(path.join(__dirname, 'lighting-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'lighting-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  ;({ default: LightLayer, lightWorldPosition, lightRGB } = compiled.exports)
})

test('original SEC light witnesses project in the converted object axes', () => {
  // Original SEC center records are world(104,82)/(98,82)/(107,96)/(107,92).
  // Converted object/light axes reverse those coordinates. Original offsets
  // stay in screen pixels; they must not be inverse-projected or transposed.
  const records = [
    { location: [82, 104], offset: [19, -2] },
    { location: [82, 98], offset: [-3, 16] },
    { location: [96, 107], offset: [-20, -5] },
    { location: [92, 107], offset: [-14, -1] }
  ]
  assert.deepEqual(records.map(lightWorldPosition), [
    { x: -861, y: 3718 },
    { x: -643, y: 3616 },
    { x: -460, y: 4055 },
    { x: -614, y: 3979 }
  ])
  assert.deepEqual(lightWorldPosition({ location: { x: 96, y: 107 } }), {
    x: -440, y: 4060
  })
})

test('lighting requires original RGB bytes instead of malformed legacy rgba', () => {
  assert.deepEqual(lightRGB([73, 73, 73]), [73, 73, 73])
  assert.deepEqual(lightRGB([114, 92, 54]), [114, 92, 54])
  for (const value of ['rgba(0, 114, 92, 54)', [114, 92], [114, 92, 256], [1, 2, NaN]] as const) {
    assert.throws(() => lightRGB(value), /original.*color bytes/)
  }
})

test('unsupported light flags are recorded before allocating graphics', () => {
  const layer = Object.create(LightLayer.prototype)
  layer.skipped = []
  for (const flags of [1, 2, 4, 8, 16, -1, NaN] as const) {
    assert.equal(layer.addLight({ flags, resource: { name: 'Disk3X3' } }, null), null)
  }
  assert.equal(layer.skipped.length, 7)
  assert.ok(layer.skipped.every(entry => entry.reason === 'Unsupported static light flags'))
})

test('non-finite light positions fail before a mask can affect the renderer', () => {
  for (const light of [
    { location: [Infinity, 82] },
    { location: [82, 98], offset: [0, NaN] },
    { location: null }
  ] as const) {
    assert.throws(() => lightWorldPosition(light), /light (location|offset)/)
  }
})

test('lighting targets are idempotent and retain unrelated filters and parent order', () => {
  const layer = Object.create(LightLayer.prototype)
  layer.targets = new Set()
  layer.filter = { name: 'light-multiply' }
  const existing = { name: 'existing-filter' }
  const order = [{ name: 'wall' }, { name: 'fire' }, { name: 'actor' }]
  const parent = { children: order }
  const ordinary = { filters: [existing], parent }
  const other = { filters: null, parent }
  assert.equal(layer.addTarget(ordinary), ordinary)
  layer.addTarget(ordinary)
  layer.addTarget(other)
  assert.equal(layer.targets.size, 2)
  assert.deepEqual(ordinary.filters, [existing, layer.filter])
  assert.deepEqual(other.filters, [layer.filter])
  assert.equal(ordinary.parent, parent)
  assert.equal(other.parent, parent)
  assert.equal(parent.children, order)
  assert.throws(() => layer.addTarget({ destroyed: true }), /destroyed target/)
})

test('object samples use original atlas pixels, hotspots, tint and saturated light overlap', () => {
  const layer = Object.create(LightLayer.prototype)
  layer.ambient = [32, 48, 64]
  layer.maskPixels = new Map()
  // One trimmed frame, stored away from the atlas origin. Outside atlas cells
  // are bright red, so a mistaken atlas or trim lookup cannot pass.
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 0; i < data.length; i += 4) data.set([255, 0, 0, 255], i)
  data.set([128, 128, 128, 255], (1 * 4 + 1) * 4)
  data.set([255, 255, 255, 255], (1 * 4 + 2) * 4)
  data.set([255, 255, 255, 0], (2 * 4 + 1) * 4)
  data.set([255, 255, 255, 128], (2 * 4 + 2) * 4)
  const texture = { frame: { x: 1, y: 1, width: 2, height: 2 },
    orig: { width: 4, height: 4 }, trim: { x: 1, y: 1 } }
  const mask = { texture, x: 30, y: 40, anchor: { x: 0.5, y: 0.5 }, tint: 0x64788c }
  layer.maskPixels.set(mask, { data, width: 4, height: 4 })
  assert.deepEqual(layer.sampleColor({ x: 29, y: 39 }), [82, 108, 134])
  assert.deepEqual(layer.sampleColor({ x: 30, y: 39 }), [132, 168, 204])
  assert.deepEqual(layer.sampleColor({ x: 29, y: 40 }), [32, 48, 64])
  assert.deepEqual(layer.sampleColor({ x: 30, y: 40 }), [82, 108, 134])
  assert.deepEqual(layer.sampleColor({ x: 28, y: 39 }), [32, 48, 64])
  assert.deepEqual(layer.sampleColor({ x: 31, y: 39 }), [32, 48, 64])
  layer.maskPixels.set({ ...mask, tint: 0xa07864 }, { data, width: 4, height: 4 })
  assert.deepEqual(layer.sampleColor({ x: 30, y: 39 }), [255, 255, 255])
  assert.throws(() => layer.sampleColor({ x: NaN, y: 40 }), /sample position/)
  layer.ambient = [0, 0, 0]
  layer.maskPixels.clear()
  layer.maskPixels.set({ ...mask, tint: 0x010101 }, { data, width: 4, height: 4 })
  layer.maskPixels.set({ ...mask, tint: 0x010101 }, { data, width: 4, height: 4 })
  assert.deepEqual(layer.sampleColor({ x: 29, y: 39 }), [0, 0, 0],
    'Each original palette multiplication must truncate before overlap addition')
})

test('sampled lighting follows ground movement and ambient changes without adding sprite filters', () => {
  const layer = Object.create(LightLayer.prototype)
  layer.targets = new Set()
  layer.sampledTargets = new Map()
  layer.revision = 0
  const existingFilter = {}
  const target = mutableFixture({ tint: 0xc87850, filters: [existingFilter], parent: {} })
  let position = { x: 1, y: 2 }
  let calls = 0
  layer.sampleColor = point => { calls++; return point.x === 1 ? [128, 64, 255] : [255, 128, 64] }
  assert.equal(layer.addSampledTarget(target, () => position), target)
  layer.addSampledTarget(target, () => position)
  layer.updateSampledTargets()
  assert.equal(target.tint, 0x641e50)
  assert.equal(calls, 1)
  layer.updateSampledTargets()
  assert.equal(calls, 1, 'Stationary objects must reuse their sampled color')
  position = { x: 2, y: 2 }
  layer.updateSampledTargets()
  assert.equal(target.tint, 0xc83c14)
  assert.equal(calls, 2)
  layer.revision++ // Changing ambient or masks invalidates stationary samples.
  layer.updateSampledTargets()
  assert.equal(calls, 3)
  assert.deepEqual(target.filters, [existingFilter])
  assert.equal(layer.sampledTargets.size, 1)
  assert.throws(() => layer.addTarget(target), /cannot also/)
  layer.targets.add({})
  assert.throws(() => layer.addSampledTarget([...layer.targets][0], () => position), /cannot also/)
  assert.throws(() => layer.addSampledTarget({}, null), /ground point callback/)
  target.destroyed = true
  layer.updateSampledTargets()
  assert.equal(layer.sampledTargets.size, 0)
})
