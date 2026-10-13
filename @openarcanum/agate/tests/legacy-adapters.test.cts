const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const {before, test} = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const root = path.resolve(__dirname, '../../..')
let adapters
before(async () => {
  const {build} = await import('esbuild')
  const result = await build({absWorkingDir: root, stdin: {contents: `
    export {default as ServerNetwork} from './server/ServerNetwork.ts';
    export {default as Realm} from './libs/Realm.ts';
    export {default as Google, configureGoogleProvider} from './libs/google/Google.ts';
    export {default as Auth} from './libs/google/Auth.ts';
    export {default as YouTube} from './libs/google/YouTube.ts';
    export {default as Electron} from './libs/Electron.ts';
    export {default as EventEmitter} from './shared/misc/EventEmitter.ts';
  `, resolveDir: path.join(root, '@openarcanum/agate/src'), sourcefile: 'legacy-adapter-tests.ts'},
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron','workerpool'], loader: {'.glsl': 'text'}})
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  adapters = compiled.exports
})

test('unconfigured dormant adapters fail explicitly without opening a server or SDK session', async () => {
  const server = new adapters.ServerNetwork({events: new adapters.EventEmitter()})
  await assert.rejects(server.start(), /requires an explicit LegacyNetworkProvider/)
  assert.equal(server.socket, undefined)
  await assert.rejects(adapters.Realm.open({path: '/unused.realm', schema: []}), /configured Realm provider/)
  assert.throws(() => adapters.Google(), /configured SDK provider/)
  assert.throws(() => adapters.Electron.createModal({}), /configured desktop host provider/)
  assert.doesNotThrow(() => new adapters.YouTube(), 'importing/constructing the wrapper does not request an SDK or credentials')
})

test('legacy queue preserves step ordering and rejects invalid schedule keys', () => {
  const server = new adapters.ServerNetwork({events: new adapters.EventEmitter()})
  server.queueInputForPlayer({step: 9, input: 'later'}, 'player')
  server.queueInputForPlayer({step: 3, input: 'first'}, 'player')
  server.queueInputForPlayer({step: 3, input: 'second'}, 'player')
  assert.deepEqual(server.playerInputQueues.player[3].map(value => value.input), ['first', 'second'])
  assert.equal(server.playerInputQueues.player[9][0].input, 'later')
  assert.throws(() => server.queueInputForPlayer({step: -1}, 'player'), /Invalid legacy input step/)
  assert.throws(() => server.queueInputForPlayer({step: 1.5}, 'player'), /Invalid legacy input step/)
})

test('Realm facade delegates only to the explicitly provided store', async () => {
  const calls = []
  const store = {write(callback) {calls.push('write'); callback()}, create(name, value) {calls.push(name); return value},
    delete() {}, objects() {return []}, objectForPrimaryKey() {return undefined}}
  adapters.Realm.configure({async open(config) {calls.push(config.path); return store}})
  try {
    const database = await adapters.Realm.open({path: '/configured.realm', schema: []})
    assert.equal(database, store)
    assert.throws(() => new adapters.Realm({path: '/configured.realm', schema: []}), /configured Realm provider/)
    assert.deepEqual(calls, ['/configured.realm'])
  } finally {adapters.Realm.configure(undefined)}
})
