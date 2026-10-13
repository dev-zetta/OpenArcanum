const { mutableFixture } = require('./fixture-types.cts') as { mutableFixture: import('./fixture-types.cjs').MutableFixtureFactory }
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')

let objectLightPosition

before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    entryPoints: [path.join(__dirname, '../src/client/ObjectLightPosition.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    write: false
  })
  const compiled = mutableFixture({ exports: {} })
  new Function('module', 'exports', result.outputFiles[0].text)(compiled, compiled.exports)
  objectLightPosition = compiled.exports.default
})

test('ordinary object samples share the recovered SEC light origins', () => {
  const entity = { base: { type: 'Scenery', location: [0, 0] } }
  const witnesses = [
    [3280, 4160, [19, -2], { x: -861, y: 3718 }],
    [3280, 3920, [-3, 16], { x: -643, y: 3616 }],
    [3840, 4280, [-20, -5], { x: -460, y: 4055 }],
    [3680, 4280, [-14, -1], { x: -614, y: 3979 }]
  ]
  for (const [isoX, isoY, offset, expected] of witnesses) {
    assert.deepEqual(objectLightPosition(entity, { iso: { isoX, isoY, offset } }), expected)
  }
})

test('object illumination follows fractional rendered movement and screen offset', () => {
  const entity = { base: { type: 'Pc', location: [93, 99], offset: [200, 300] } }
  const sprite = mutableFixture({ iso: { isoX: 3720, isoY: 3960, offset: { x: 7, y: -3 }, isoZ: 100 } })
  assert.deepEqual(objectLightPosition(entity, sprite), { x: -233, y: 3837 })
  // The logical tile still names the starting cell during interpolation.
  sprite.iso.isoX = 3725.5
  sprite.iso.isoY = 3957.5
  sprite.iso.anchor = { x: 0.5, y: 0.9 }
  sprite.iso.scale = { x: -1, y: 2 }
  sprite.iso.x = 8000
  sprite.iso.y = -100
  assert.deepEqual(objectLightPosition(entity, sprite), { x: -225, y: 3838.5 })
})

test('actual Bates portal sides sample the original adjacent half-tile', () => {
  // Converted portal witnesses: FBFD(side1), B842(side3), 2062(side5), 02B4(side7).
  // In original axes direction3 increments Y and direction5 increments X.
  const witnesses = [
    [[87, 90], 1, { x: -100, y: 3530 }],
    [[106, 108], 3, { x: -60, y: 4290 }],
    [[100, 110], 5, { x: -420, y: 4210 }],
    [[98, 97], 7, { x: 20, y: 3890 }]
  ]
  for (const [location, side, expected] of witnesses) {
    const entity = { base: { type: 'Portal', location, offset: [200, 300] } }
    // ART placement has independent shifts; these and object offsets are not
    // the original portal lighting point, even for flipped artwork.
    const sprite = { meta: { side, flipped: true }, iso: { isoX: -999, isoY: 999 } }
    assert.deepEqual(objectLightPosition(entity, sprite), expected)
    assert.deepEqual(objectLightPosition(entity, { meta: { side: Number(side) - 1 } }), expected)
  }
})

test('ordinary offsets default to zero while invalid samples fail explicitly', () => {
  const entity = { base: { type: 'Npc' } }
  assert.deepEqual(objectLightPosition(entity, { iso: { isoX: 3320, isoY: 3880 } }),
    { x: -560, y: 3600 })
  assert.throws(() => objectLightPosition(entity, { iso: { isoX: NaN, isoY: 3880 } }), /rendered position/)
  assert.throws(() => objectLightPosition(entity, { iso: { isoX: 0, isoY: 0, offset: [0, Infinity] } }), /screen offset/)
  assert.throws(() => objectLightPosition({ base: { type: 'Wall' } }, {}), /directional samples/)
  assert.throws(() => objectLightPosition({ base: { type: 'Portal', location: [1, 2] } }, { meta: { side: 8 } }), /portal side/)
})
