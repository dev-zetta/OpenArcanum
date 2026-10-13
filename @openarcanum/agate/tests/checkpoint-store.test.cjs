const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

let CheckpointStore, MAX_CHECKPOINT_BYTES, captureContentIdentity
before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    stdin: { contents: `
      export { default as CheckpointStore, MAX_CHECKPOINT_BYTES } from './CheckpointStore.js';
      export { captureContentIdentity } from './ContentIdentity.js';`,
    resolveDir: path.resolve(__dirname, '../src/server/authority') },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled._compile(result.outputFiles[0].text, __filename + '.bundle.cjs')
  ;({ CheckpointStore, MAX_CHECKPOINT_BYTES, captureContentIdentity } = compiled.exports)
})

async function slot(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openarcanum-checkpoint-store-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filename = path.join(directory, 'saves', 'checkpoint.json')
  return { directory, filename, store: new CheckpointStore(filename) }
}

const code = expected => error => {
  assert.equal(error.code, expected)
  assert.doesNotMatch(error.message, /\/tmp\/|EACCES|ENOENT|synthetic secret/)
  return true
}

test('a checkpoint is atomically replaced, privately readable and leaves no temporary file', async t => {
  const { store, filename } = await slot(t)
  await store.write({ marker: 'first', actor: { location: [93, 99] } })
  assert.deepEqual(await store.read(), { marker: 'first', actor: { location: [93, 99] } })
  await store.write({ marker: 'second' })
  assert.deepEqual(await store.read(), { marker: 'second' })
  assert.deepEqual(await fs.readdir(path.dirname(filename)), ['checkpoint.json'])
  if (process.platform !== 'win32') assert.equal((await fs.stat(filename)).mode & 0o777, 0o600)
})

test('a failed atomic rename preserves the previous checkpoint and removes its temporary file', async t => {
  const { store, filename } = await slot(t)
  await store.write({ marker: 'good' })
  const previous = await fs.readFile(filename)
  const broken = new CheckpointStore(filename, { filesystem: { ...fs,
    async rename() { throw Object.assign(new Error('synthetic secret rename failure'), { code: 'EACCES' }) }
  } })
  await assert.rejects(broken.write({ marker: 'bad' }), code('CHECKPOINT_IO_ERROR'))
  assert.deepEqual(await fs.readFile(filename), previous)
  assert.deepEqual(await fs.readdir(path.dirname(filename)), ['checkpoint.json'])
})

test('missing, corrupt and oversized checkpoint files fail with bounded sanitized errors', async t => {
  const { store, filename } = await slot(t)
  await assert.rejects(store.read(), code('CHECKPOINT_NOT_FOUND'))
  await fs.mkdir(path.dirname(filename))
  await fs.writeFile(filename, '{invalid-json')
  await assert.rejects(store.read(), code('CHECKPOINT_INVALID'))
  await fs.writeFile(filename, Buffer.alloc(MAX_CHECKPOINT_BYTES + 1, 32))
  await assert.rejects(store.read(), code('CHECKPOINT_INVALID'))
})

test('invalid or oversized writes cannot replace a good checkpoint', async t => {
  const { store } = await slot(t)
  await store.write({ marker: 'good' })
  const cyclic = {}; cyclic.self = cyclic
  for (const document of [null, [], cyclic, { value: 'x'.repeat(MAX_CHECKPOINT_BYTES) }]) {
    await assert.rejects(store.write(document), code('CHECKPOINT_INVALID'))
    assert.deepEqual(await store.read(), { marker: 'good' })
  }
})

test('checkpoint storage refuses file and directory symlinks without changing their targets', async t => {
  const { directory, filename, store } = await slot(t)
  await fs.mkdir(path.dirname(filename))
  const target = path.join(directory, 'original.json')
  await fs.writeFile(target, '{"marker":"untouched"}')
  await fs.symlink(target, filename)
  await assert.rejects(store.read(), code('CHECKPOINT_IO_ERROR'))
  await assert.rejects(store.write({ marker: 'bad' }), code('CHECKPOINT_IO_ERROR'))
  assert.equal(await fs.readFile(target, 'utf8'), '{"marker":"untouched"}')
  await fs.unlink(filename)
  await fs.rmdir(path.dirname(filename))
  const targetDirectory = path.join(directory, 'other')
  await fs.mkdir(targetDirectory)
  await fs.writeFile(path.join(targetDirectory, 'checkpoint.json'), '{"marker":"untouched"}')
  await fs.symlink(targetDirectory, path.dirname(filename), 'dir')
  await assert.rejects(store.read(), code('CHECKPOINT_IO_ERROR'))
  await assert.rejects(store.write({ marker: 'bad' }), code('CHECKPOINT_IO_ERROR'))
  assert.deepEqual(await fs.readdir(targetDirectory), ['checkpoint.json'])
})

async function identity(records, order = Object.keys(records), mapId = 'Bates') {
  const loader = { async loadJsonFile(filename) { return records[filename] } }
  const original = loader.loadJsonFile
  const capture = captureContentIdentity(loader)
  await Promise.all(order.map(filename => loader.loadJsonFile(filename)))
  const result = capture.finish(mapId)
  assert.equal(loader.loadJsonFile, original)
  assert.match(result, /^[a-f0-9]{64}$/)
  return result
}

test('content identity is independent of load completion order and JSON property order', async () => {
  const first = await identity({ 'map.json': { width: 3, tiles: [0, 1] }, 'player.json': { id: 0, flags: [] } })
  const reordered = await identity({ 'player.json': { flags: [], id: 0 }, 'map.json': { tiles: [0, 1], width: 3 } })
  assert.equal(first, reordered)
})

test('content identity changes with loaded geometry, overlays, player data, missing records or map identity', async () => {
  const original = { 'map.json': { tiles: [0, 1] }, 'player.json': { prototype: 16086 } }
  const baseline = await identity(original)
  for (const records of [
    { ...original, 'map.json': { tiles: [1, 0] } },
    { ...original, 'player.json': { prototype: 16087 } },
    { ...original, 'overlay.json': {} },
    { ...original, 'overlay.json': undefined },
  ]) assert.notEqual(await identity(records), baseline)
  assert.notEqual(await identity(original, Object.keys(original), 'Other map'), baseline)
})

test('content identity survives relocating converted data with an absolute player-template request', async () => {
  const relocated = async dataPath => {
    const loader = { async loadJsonFile(filename) {
      return path.basename(filename) === '16086.json' ? { prototype: 16086 } : { tiles: [0, 1] }
    } }
    const capture = captureContentIdentity(loader, { dataPath })
    await loader.loadJsonFile('Bates/map.json')
    await loader.loadJsonFile(path.join(dataPath, '16086.json'))
    return capture.finish('Bates')
  }
  assert.equal(await relocated(path.join(os.tmpdir(), 'original-data')),
    await relocated(path.join(os.tmpdir(), 'moved-data')))
})

test('identity captures raw data before prototype mutation and refuses incomplete or changing loads', async () => {
  const raw = { flags: [] }
  let finish
  const loader = { loadJsonFile() { return new Promise(resolve => { finish = resolve }) } }
  const capture = captureContentIdentity(loader)
  const loading = loader.loadJsonFile('prototype.json')
  assert.throws(() => capture.finish('Bates'), /not ready/)
  finish(raw)
  await loading
  raw.flags.push('mutated-by-legacy-loader')
  assert.equal(capture.finish('Bates'), await identity({ 'prototype.json': { flags: [] } }))
  assert.throws(() => capture.finish('Bates'), /not ready/)
  const changingLoader = { async loadJsonFile() { return { value: this.value++ } }, value: 0 }
  captureContentIdentity(changingLoader)
  await changingLoader.loadJsonFile('same.json')
  await assert.rejects(changingLoader.loadJsonFile('same.json'), /content changed/)
})
