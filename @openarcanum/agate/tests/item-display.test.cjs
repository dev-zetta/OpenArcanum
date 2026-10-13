const assert = require('node:assert/strict')
const { before, test } = require('node:test')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL } = require('../../../examples/inventory-workshop/generate.cjs')

const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
let engine

before(async () => {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  const result = await build({ absWorkingDir: root,
    stdin: { contents: `export { default as ItemDisplayCatalog, loadItemDisplayCatalog,
      MAX_ITEM_LABEL_LENGTH, MAX_ITEM_DISPLAY_ROWS, MAX_ITEM_DISPLAY_BYTES } from './server/authority/ItemDisplayCatalog.js';
      export { createAuthorityServer } from './server/authority/AuthorityServer.js';`,
    resolveDir: source, sourcefile: 'item-display-tests.js' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' },
    plugins: [{ name: 'item-display-flow', setup(builder) {
      builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
        if (!filename.startsWith(source + path.sep)) return
        const transformed = await transformAsync(await fs.readFile(filename, 'utf8'), {
          filename, configFile: false, babelrc: false,
          plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
        })
        return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
      })
    } }],
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  engine = compiled.exports
})

const item = (base = {}, values = {}) => ({ base: { type: 'Generic', descIndex: 12, ...base },
  item: { magicTechComplexity: 0, descriptionUnknown: 13, flags: new Set(), ...values } })
const catalog = rows => new engine.ItemDisplayCatalog({ Description: rows || [
  { id: '12', text: 'Known name' }, { id: '13', text: 'Unknown appearance' },
] })

test('catalog indexes row IDs for arrays and ordinal objects and copies immutable labels', () => {
  const data = { Description: { 0: { id: '13', text: 'Unknown appearance' }, 4: { id: 12, text: 'Known name' } } }
  const display = new engine.ItemDisplayCatalog(data)
  assert.equal(display.labelFor(item()), 'Known name')
  assert.equal(display.labelFor(item({}, { magicTechComplexity: 5 })), 'Unknown appearance')
  assert.equal(display.labelFor(item({ descIndex: 4 }), 'Fallback'), 'Fallback', 'ordinal key is not a description ID')
  data.Description[4].text = 'Changed after construction'
  assert.equal(display.labelFor(item()), 'Known name')
  assert.equal(Object.isFrozen(display), true)
  const inherited = { base: Object.create({ type: 'Generic', descIndex: 12 }),
    item: Object.create({ magicTechComplexity: 0, descriptionUnknown: 13, flags: new Set() }) }
  assert.equal(display.labelFor(inherited), 'Known name', 'effective prototype fields are readable without writes')
  inherited.base.descIndex = 13
  assert.equal(display.labelFor(inherited), 'Unknown appearance', 'instance override wins')
  assert.equal(Object.getPrototypeOf(inherited.base).descIndex, 12)
})

test('identification uses only explicit flags or safe nonpositive complexity', () => {
  const display = catalog()
  for (const complexity of [0, -1, -10, Number.MIN_SAFE_INTEGER]) {
    assert.equal(display.labelFor(item({}, { magicTechComplexity: complexity })), 'Known name')
  }
  for (const complexity of [1, 40, undefined, null, '0', 0.5, NaN, Infinity, -Infinity, -Number.MAX_VALUE]) {
    assert.equal(display.labelFor(item({}, { magicTechComplexity: complexity })), 'Unknown appearance', String(complexity))
    assert.equal(display.labelFor(item({}, { magicTechComplexity: complexity, flags: new Set(['Identified']) })), 'Known name')
  }
  assert.equal(display.labelFor(item({ nameIndex: 12, descIndex: undefined })), 'Item', 'Base.nameIndex is never a text fallback')
})

test('unknown, absent and module descriptions never reveal the known name', () => {
  const display = catalog()
  for (const id of [undefined, null, '', '012', '-0', '-1', '12.0', ' 12', 12.5, -1, 30000, '30000', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(display.labelFor(item({}, { magicTechComplexity: 5, descriptionUnknown: id }), 'Weapon'), 'Weapon', String(id))
    assert.equal(display.labelFor(item({ descIndex: id }), 'Weapon'), 'Weapon', String(id))
  }
  assert.equal(display.labelFor(item({}, { magicTechComplexity: 5, descriptionUnknown: 99 })), 'Item')
  assert.equal(display.labelFor(item({ descIndex: 99 })), 'Item', 'identified missing text does not guess unknown text either')
  const zero = catalog([{ id: '0', text: 'Zero description' }])
  assert.equal(zero.labelFor(item({ descIndex: 0 })), 'Zero description')
})

test('keys and keyrings retain the conservative type label despite valid system descriptions', () => {
  const display = catalog()
  for (const type of ['Key', 'KeyRing', 'Keyring']) {
    for (const complexity of [0, 5]) {
      const fallback = type === 'Key' ? 'Key' : 'Key ring'
      assert.equal(display.labelFor(item({ type }, { magicTechComplexity: complexity }), fallback), fallback)
    }
  }
})

test('malformed and duplicate catalog rows fail safely with bounded plain text', () => {
  const rows = [null, [], 3, { id: '12', text: 'First' }, { id: 12, text: 'Second' }, { id: '12', text: 'Third' },
    { id: '13', text: 'Unknown appearance' }, { id: '13', text: 4 },
    { id: '14', text: '' }, { id: '15', text: '   ' }, { id: '16', text: 'x'.repeat(engine.MAX_ITEM_LABEL_LENGTH + 1) },
    { id: '17', text: '\u0000hidden' }, { id: '018', text: 'Noncanonical ID' }, { id: '30000', text: 'Wrong namespace' },
    { id: '19', text: '<b>Literal markup</b>' }, { id: '20', text: 'x'.repeat(engine.MAX_ITEM_LABEL_LENGTH) }]
  const display = catalog(rows)
  for (const id of [12, 13, 14, 15, 16, 17, 18, 30000]) assert.equal(display.labelFor(item({ descIndex: id })), 'Item')
  assert.equal(display.labelFor(item({ descIndex: 19 })), '<b>Literal markup</b>', 'catalog supplies a string, never markup interpretation')
  assert.equal(display.labelFor(item({ descIndex: 20 })).length, engine.MAX_ITEM_LABEL_LENGTH)
  for (const data of [null, [], {}, { Description: null }, { Description: 'text' }, { Description: { named: rows[10] } }]) {
    assert.equal(new engine.ItemDisplayCatalog(data).labelFor(item()), 'Item')
  }
  const oversized = Array.from({ length: engine.MAX_ITEM_DISPLAY_ROWS + 1 }, (_, id) => ({ id, text: 'Name' }))
  assert.equal(catalog(oversized).labelFor(item()), 'Item')
  const broken = { get item() { throw new Error('broken component') } }
  assert.equal(display.labelFor(broken, 'Fallback'), 'Fallback')
})

test('optional file loading handles missing, malformed and oversized catalogs without shared state', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-item-labels-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filename = path.join(directory, 'mes', 'Description.json')
  assert.equal((await engine.loadItemDisplayCatalog(directory)).labelFor(item()), 'Item')
  await fs.mkdir(path.dirname(filename))
  await fs.writeFile(filename, '{invalid')
  assert.equal((await engine.loadItemDisplayCatalog(directory)).labelFor(item()), 'Item')
  await fs.writeFile(filename, Buffer.alloc(engine.MAX_ITEM_DISPLAY_BYTES + 1, 32))
  assert.equal((await engine.loadItemDisplayCatalog(directory)).labelFor(item()), 'Item')
  await fs.writeFile(filename, '\uFEFF' + JSON.stringify({ Description: [{ id: '12', text: 'First host' }] }))
  const first = await engine.loadItemDisplayCatalog(directory)
  await fs.writeFile(filename, JSON.stringify({ Description: [{ id: '12', text: 'Second host' }] }))
  const second = await engine.loadItemDisplayCatalog(directory)
  assert.equal(first.labelFor(item()), 'First host', 'running host never hot-reloads text')
  assert.equal(second.labelFor(item()), 'Second host')
})

async function worldFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-private-labels-'))
  await generate(directory)
  const dataPath = path.join(directory, 'data'), checkpointPath = path.join(directory, 'checkpoint.json')
  const hosts = []
  t.after(async () => {
    for (const server of hosts) await server.stop()
    await fs.rm(directory, { recursive: true, force: true })
  })
  const start = async () => {
    const server = engine.createAuthorityServer({ dataPath, mapId: MAP_ID, checkpointPath })
    hosts.push(server)
    await server.loadWorld()
    const owner = { data: { joined: true, role: 'owner' } }
    let id = 0
    const command = (type, extra = {}) => server.command(owner, { version: 1, id: ++id, actorId: '0', type, ...extra })
    const approach = () => { command('use', { targetId: BOX_ID }); server.advanceMovement(performance.now() + 10000) }
    const transfer = type => command(type, { targetId: BOX_ID, ...(type === 'take-all' ? {} : { itemId: TOKEN_ID }),
      expectedRevision: server.revision })
    return { server, command, approach, transfer }
  }
  return { directory, dataPath, checkpointPath, start }
}

test('headless private responses use names while ownership signatures, ledger and public state stay generic', async t => {
  const { start } = await worldFixture(t)
  const { server, command, approach, transfer } = await start()
  approach()
  const rawBefore = server.containers.ownership(server.containers.states.get(BOX_ID))
  assert.equal(rawBefore.items[0].label, 'Item')
  const inspected = command('inspect', { targetId: BOX_ID })
  assert.equal(inspected.result.items[0].label, TOKEN_LABEL)
  assert.equal(server.containers.ownership(server.containers.states.get(BOX_ID)).signature, rawBefore.signature)
  const taken = transfer('take')
  assert.equal(taken.result.inventory.items[0].label, TOKEN_LABEL)
  assert.equal(command('inventory').result.items[0].label, TOKEN_LABEL)
  assert.equal(server.ownership.actorInventory().items[0].label, 'Item')
  assert.equal(transfer('put').result.items[0].label, TOKEN_LABEL)
  const batch = transfer('take-all')
  assert.equal(batch.result.inventory.items[0].label, TOKEN_LABEL)
  const publicState = JSON.stringify(server.getSnapshot())
  assert.equal(publicState.includes(TOKEN_ID), false)
  assert.equal(publicState.includes(TOKEN_LABEL), false)
  assert.equal(JSON.stringify(server.createCheckpoint()).includes(TOKEN_LABEL), false)
})

test('text-only catalog changes preserve checkpoint identity and load the same supported ownership', async t => {
  const { start, dataPath, checkpointPath } = await worldFixture(t)
  const first = await start()
  first.approach(); assert.equal(first.transfer('take').ok, true)
  assert.equal((await first.command('save')).ok, true)
  const savedBytes = await fs.readFile(checkpointPath, 'utf8')
  const identity = first.server.contentIdentity
  await fs.writeFile(path.join(dataPath, 'mes', 'Description.json'), JSON.stringify({ Description: {
    17: { id: '9003', text: 'Renamed workshop token' },
  } }))
  assert.equal(first.command('inventory').result.items[0].label, TOKEN_LABEL, 'live catalog is immutable')
  await first.server.stop()
  const second = await start()
  assert.equal(second.server.contentIdentity, identity)
  assert.equal((await second.command('load')).ok, true)
  const inventory = second.command('inventory').result
  assert.equal(inventory.items[0].id, TOKEN_ID)
  assert.equal(inventory.items[0].label, 'Renamed workshop token')
  assert.equal(second.server.ownership.items.get(TOKEN_ID).entity.item.parent, '16086.json')
  assert.equal(await fs.readFile(checkpointPath, 'utf8'), savedBytes, 'load does not rewrite the checkpoint')
})

test('absent optional text leaves a buildable headless session with the existing type fallback', async t => {
  const { start, dataPath } = await worldFixture(t)
  await fs.rm(path.join(dataPath, 'mes', 'Description.json'))
  const { server, command, approach, transfer } = await start()
  approach()
  assert.equal(command('inspect', { targetId: BOX_ID }).result.items[0].label, 'Item')
  assert.equal(transfer('take').result.inventory.items[0].label, 'Item')
  assert.doesNotThrow(() => server.validateCheckpoint(server.createCheckpoint()))
})
