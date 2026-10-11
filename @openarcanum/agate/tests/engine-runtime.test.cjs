const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  const result = await build({
    absWorkingDir: root,
    stdin: {
      contents: `
        export { default as AGate } from './AGate.js';
        export { default as UID } from './shared/entity/UID.js';
        export { default as ClientNetwork } from './client/network/ClientNetwork.js';
        export { default as AssetLoader } from './shared/assets/AssetLoader.js';
        export { default as SectorCache } from './shared/map/SectorCache.js';
        export { default as Spritesheet } from './client/isometric/Spritesheet.js';
        export { default as IsoSprite } from './client/isometric/Sprite.js';
        export { default as PIXI } from './client/libs/PIXI.js';
        export { Filter } from './client/render/Filter.js';
      `,
      resolveDir: source,
      sourcefile: 'engine-test-entry.js',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    write: false,
    external: ['electron', 'workerpool'],
    loader: { '.glsl': 'text' },
    plugins: [{
      name: 'test-flow-source',
      setup(builder) {
        builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
          if (!filename.startsWith(source + path.sep)) return
          const transformed = await transformAsync(await fs.readFile(filename, 'utf8'), {
            filename,
            configFile: false,
            babelrc: false,
            plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
          })
          return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
        })
      },
    }],
  })
  const compiled = new Module(path.join(__dirname, 'engine-test-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'engine-test-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

test('the complete active engine graph loads without a DOM or game assets', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(typeof engine.AGate, 'function')
  assert.equal(typeof engine.AGate.prototype.createEngine, 'function')
})

test('entity UUIDs remain unique across repeated generation', () => {
  const generator = new engine.UID.UUIDGenerator()
  const ids = Array.from({ length: 1000 }, () => generator.next())
  assert.equal(new Set(ids).size, ids.length)
  assert.match(ids[0], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('Socket.IO CONNECT_ERROR rejects the connection promise with its original message', async () => {
  const client = { options: { serverURL: 'http://127.0.0.1:1' }, stopped: false }
  const previousLog = globalThis.lll
  const previousErrorLog = globalThis.lle
  globalThis.lll = globalThis.lle = () => {}
  try {
    // Disable transport startup: inject the decoded protocol packet directly.
    const connected = engine.ClientNetwork.prototype.connect.call(client, { autoConnect: false })
    const rejected = assert.rejects(connected, error => {
      assert.equal(error.message, 'Connection denied by the server')
      assert.deepEqual(error.data, { code: 'ACCESS_DENIED' })
      return true
    })
    await Promise.resolve()
    client.socket.socket.onpacket({
      type: 4, // Socket.IO protocol CONNECT_ERROR
      nsp: '/',
      data: { message: 'Connection denied by the server', data: { code: 'ACCESS_DENIED' } }
    })
    await rejected
  } finally {
    globalThis.lll = previousLog
    globalThis.lle = previousErrorLog
  }
})

test('asset JSON round trips Unicode, creates directories, and accepts a UTF-8 BOM', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-json-'))
  const previousEngine = globalThis.AGate
  globalThis.AGate = { getAppPath: filename => filename }
  try {
    const loader = new engine.AssetLoader()
    const filename = path.join(dir, 'nested', 'sample.json')
    const expected = { name: 'Magick — Příliš žluťoučký', value: 123 }
    await loader.saveJsonFile(filename, expected)
    assert.deepEqual(await loader.loadJsonFile(filename), expected)
    await fs.writeFile(filename, '\uFEFF' + JSON.stringify(expected), 'utf8')
    assert.deepEqual(await loader.loadJsonFile(filename), expected)
  } finally {
    if (previousEngine === undefined) delete globalThis.AGate
    else globalThis.AGate = previousEngine
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('sector cache looks up coordinates and evicts the least recently used entry', () => {
  const cache = new engine.SectorCache({})
  const first = { id: '0x0' }
  cache.add(first)
  for (let x = 1; x < 500; x++) cache.add({ id: `${x}x0` })
  assert.equal(cache.get(0, 0), first)
  cache.add({ id: '500x0' })
  assert.equal(cache.get('0x0'), first)
  assert.equal(cache.has(1, 0), false)
  assert.equal(cache.size, 500)
})

test('Pixi 8 atlas frames retain trim, rotation, anchors and cache lookup', () => {
  const { PIXI, Spritesheet, IsoSprite } = engine
  const source = new PIXI.TextureSource({ width: 64, height: 64 })
  const sheet = new Spritesheet(source, { frames: {
    'test/0': {
      frame: { x: 3, y: 4, w: 8, h: 6 },
      sourceSize: { w: 12, h: 10 },
      spriteSourceSize: { x: 2, y: 1 },
      anchor: { x: 0.25, y: 0.75 },
    },
    'test/1': { frame: { x: 20, y: 4, w: 8, h: 6 }, rotated: true, trimmed: false },
  } })
  try {
    const frame = sheet.getTextureByIndex(0)
    assert.deepEqual([frame.frame.x, frame.frame.y, frame.frame.width, frame.frame.height], [3, 4, 8, 6])
    assert.deepEqual([frame.orig.width, frame.orig.height, frame.trim.x, frame.trim.y], [12, 10, 2, 1])
    assert.equal(sheet.getTextureByIndex(1).rotate, 2)
    assert.deepEqual([sheet.getTextureByIndex(1).frame.width, sheet.getTextureByIndex(1).frame.height], [6, 8])
    assert.equal(PIXI.Texture.from('test/0'), frame)
    const sprite = new IsoSprite({})
    sprite.setTexture('test/0')
    assert.equal(sprite.texture, frame)
    assert.deepEqual([sprite.anchor.x, sprite.anchor.y], [0.25, 0.75])
    sprite.destroy()
  } finally {
    for (const key of ['test/0', 'test/1']) {
      PIXI.Cache.remove(key)
      sheet.textures[key].destroy()
    }
    source.destroy()
  }
})
