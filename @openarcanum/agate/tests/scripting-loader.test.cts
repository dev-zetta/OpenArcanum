import type { ScriptManifest, ScriptManifestEntry } from '../dist-types/shared/scripting/NodeScriptLoader'
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const path = require('node:path') as typeof import('node:path')
const os = require('node:os') as typeof import('node:os')
const { createHash } = require('node:crypto') as typeof import('node:crypto')
const Module = require('node:module') as typeof import('node:module')
const root = path.resolve(__dirname, '../../..')
let Loader: typeof import('../dist-types/shared/scripting/NodeScriptLoader').default
let Engine: typeof import('../dist-types/shared/scripting/ScriptEngine').default
before(async () => {
  const { build } = await import('esbuild')
  const result = await build({ absWorkingDir: root, stdin: { contents: `export {default as Loader} from './shared/scripting/NodeScriptLoader.ts';
    export {default as Engine} from './shared/scripting/ScriptEngine.ts';`, resolveDir: path.join(root, '@openarcanum/agate/src'), sourcefile: 'scripting-loader-tests.ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root); compiled._compile(result.outputFiles[0].text, compiled.filename)
  ;({ Loader, Engine } = compiled.exports)
})
const sha = (value: string): string => createHash('sha256').update(value).digest('hex')
const cjs = `const {defineScript,flow}=require('@openarcanum/script-api'); let runs=0;
module.exports.default=defineScript({apiVersion:1,id:'test:server',name:'server',realm:'server',entryPoints:{0(ctx){
  ctx.shared.variable(0).value=++runs;return flow.skipDefault();}}});`
async function files(t: { after(fn: () => Promise<unknown>): void }, content = cjs) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openarcanum-script-loader-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const source = 'export default /* editable TS */ {}'
  await fs.writeFile(path.join(directory, 'server.ts'), source); await fs.writeFile(path.join(directory, 'server.cjs'), content)
  const entry: ScriptManifestEntry = { id: 'test:server', realm: 'server', source: 'server.ts', compiled: 'server.cjs', sourceSha256: sha(source), sha256: sha(content) }
  const manifest: ScriptManifest = { apiVersion: 1, scripts: [entry], symbols: { variables: { invocationCount: 0 }, flags: { known: 7 } } }
  const filename = path.join(directory, 'manifest.json')
  const write = () => fs.writeFile(filename, JSON.stringify(manifest))
  await write()
  return { directory, filename, manifest, entry, source, write }
}
test('manifest verifies API, realm, source/output hashes and named symbols before lazy module execution', async t => {
  const f = await files(t), loader = new Loader(f.filename, { realm: 'server' })
  assert.equal(loader.contentIdentity.length, 64); assert.equal(loader.symbols.variables?.invocationCount, 0)
  assert.equal(loader.resolve('test:missing', 'server'), undefined)
  assert.equal(loader.resolve('test:server', 'server')?.id, 'test:server')
  assert.throws(() => loader.resolve('test:server', 'client'), { code: 'WRONG_REALM' })
  f.manifest.apiVersion = 2 as 1; await f.write()
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'INVALID_MANIFEST' })
})
test('a source edit invalidates content even if the previously compiled module is cached', async t => {
  const f = await files(t), loader = new Loader(f.filename, { realm: 'server' })
  loader.resolve('test:server', 'server')
  await fs.writeFile(path.join(f.directory, 'server.ts'), f.source + '\n// edit')
  assert.throws(() => loader.resolve('test:server', 'server'), { code: 'CONTENT_MISMATCH' })
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'CONTENT_MISMATCH' })
})
test('output tampering, source traversal and symlink escapes are rejected', async t => {
  const f = await files(t)
  await fs.appendFile(path.join(f.directory, 'server.cjs'), '// tamper')
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'CONTENT_MISMATCH' })
  await fs.writeFile(path.join(f.directory, 'server.cjs'), cjs)
  f.entry.source = '../outside.ts'; await f.write()
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'INVALID_PATH' })
  const outside = path.join(f.directory, '..', `${path.basename(f.directory)}-outside.ts`)
  await fs.writeFile(outside, f.source); t.after(() => fs.unlink(outside))
  await fs.symlink(outside, path.join(f.directory, 'link.ts'))
  f.entry.source = 'link.ts'; await f.write()
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'INVALID_PATH' })
})
test('duplicate identities and compiled definition realm/identity mismatch cannot be loaded', async t => {
  const f = await files(t)
  f.manifest.scripts.push({ ...f.entry }); await f.write()
  assert.throws(() => new Loader(f.filename, { realm: 'server' }), { code: 'INVALID_MANIFEST' })
  f.manifest.scripts.pop()
  const wrong = cjs.replace("realm:'server'", "realm:'client'")
  await fs.writeFile(path.join(f.directory, 'server.cjs'), wrong); f.entry.sha256 = sha(wrong); await f.write()
  assert.throws(() => new Loader(f.filename, { realm: 'server' }).resolve('test:server', 'server'), { code: 'INVALID_SCRIPT' })
})
test('fresh host sessions have independent private CJS module state and stable content identity', async t => {
  const f = await files(t), a = new Loader(f.filename, { realm: 'server' }), b = new Loader(f.filename, { realm: 'server' })
  assert.equal(a.contentIdentity, b.contentIdentity)
  const host = { getObject: () => null, isOff: () => false, prepareObjectWrites: () => ({ apply() {}, rollback() {} }) }
  const first = new Engine({ host, resolver: a }), second = new Engine({ host, resolver: b })
  first.prepare({ scriptId: 'test:server' }).commit(); first.prepare({ scriptId: 'test:server' }).commit()
  second.prepare({ scriptId: 'test:server' }).commit()
  assert.equal(first.snapshot().shared.variables['test:0'], 2); assert.equal(second.snapshot().shared.variables['test:0'], 1)
})
test('schema/default mismatch is diagnosed at module load', async t => {
  const invalid = cjs.replace("entryPoints:{", "dataSchema:{version:1,defaults:{bad:true},validate:()=>false},entryPoints:{")
  const f = await files(t, invalid), loader = new Loader(f.filename, { realm: 'server' })
  assert.throws(() => loader.resolve('test:server', 'server'), { code: 'INVALID_SCHEMA' })
})
test('additional helper source hashes participate in identity and are checked on cached resolutions', async t => {
  const f = await files(t), helper = 'export const namedFlag = 7'
  await fs.writeFile(path.join(f.directory, 'symbols.ts'), helper)
  f.manifest.files = [{ path: 'symbols.ts', sha256: sha(helper) }]; await f.write()
  const loader = new Loader(f.filename, { realm: 'server' }); loader.resolve('test:server', 'server')
  await fs.writeFile(path.join(f.directory, 'symbols.ts'), helper + ' // edit')
  assert.throws(() => loader.resolve('test:server', 'server'), { code: 'CONTENT_MISMATCH' })
})

test('loader disposal clears the session cache and refuses cached or missing script resolutions', async t => {
  const f = await files(t), loader = new Loader(f.filename, { realm: 'server' })
  loader.resolve('test:server', 'server')
  loader.dispose(); loader.dispose()
  assert.throws(() => loader.resolve('test:server', 'server'), { code: 'SCRIPT_DISPOSED' })
  assert.throws(() => loader.resolve('test:missing', 'server'), { code: 'SCRIPT_DISPOSED' })
  const fresh = new Loader(f.filename, { realm: 'server' })
  const engine = new Engine({ resolver: fresh, host: {
    getObject: () => null, isOff: () => false, prepareObjectWrites: () => ({ apply() {}, rollback() {} }),
  } })
  engine.prepare({ scriptId: 'test:server' }).commit()
  assert.equal(engine.snapshot().shared.variables['test:0'], 1)
  engine.dispose()
  assert.throws(() => fresh.resolve('test:server', 'server'), { code: 'SCRIPT_DISPOSED' })
})

test('declared keys validate across an independently bundled trusted module SDK copy', async t => {
  const { build } = await import('esbuild')
  const source = `import {defineScript,defineDataKeys,bindDataStore} from './ScriptApi';
    const keys=defineDataKeys({count:{default:0,validate:(v:unknown):v is number=>typeof v==='number'}});
    export default defineScript({id:'test:server',name:'bundled keys',realm:'server',entryPoints:{0(ctx){
      bindDataStore(ctx.data,keys).set('count',1);ctx.data.count='invalid';}}});`
  const result = await build({ stdin: { contents: source, sourcefile: 'independent-module.ts',
    resolveDir: path.join(root, '@openarcanum/agate/src/shared/scripting'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false })
  const f = await files(t, result.outputFiles[0].text)
  const loader = new Loader(f.filename, { realm: 'server' }), engine = new Engine({ resolver: loader, host: {
    getObject: () => null, isOff: () => false, prepareObjectWrites: () => ({ apply() {}, rollback() {} }),
  } })
  const baseline = engine.snapshot()
  assert.throws(() => engine.prepare({ scriptId: 'test:server' }), { code: 'INVALID_DATA_KEY' })
  assert.deepEqual(engine.snapshot(), baseline)
})
