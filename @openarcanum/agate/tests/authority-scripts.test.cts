import type { AuthorityServer } from '../dist-types/server/authority/AuthorityServer'
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const syncFs = require('node:fs') as typeof import('node:fs')
const path = require('node:path') as typeof import('node:path')
const os = require('node:os') as typeof import('node:os')
const crypto = require('node:crypto') as typeof import('node:crypto')
const Module = require('node:module') as typeof import('node:module')
const { decodeScriptSlots } = require('../tools/recover-scripts.cts')
const { MAP_ID, SCRIPTED_DOOR_ID, NPC_ID } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
let make: typeof import('../dist-types/server/authority/AuthorityServer').createAuthorityServer
let Location: typeof import('../dist-types/shared/Location').default
let Scripts: typeof import('../dist-types/server/authority/AuthorityScripts').default
before(async () => {
  const { build } = await import('esbuild')
  const bundle = await build({stdin: {contents: "export {createAuthorityServer} from './server/authority/AuthorityServer.ts'; export {default as Location} from './shared/Location.ts'; export {default as Scripts} from './server/authority/AuthorityScripts.ts';",
    resolveDir: path.join(root, '@openarcanum/agate/src'), sourcefile: 'authority-script-tests.ts'}, bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron','workerpool'], loader: {'.glsl':'text'} })
  const compiled = new Module(__filename + '.bundle.cjs', module); compiled.filename = __filename + '.bundle.cjs'; compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(bundle.outputFiles[0].text, compiled.filename)
  make = compiled.exports.createAuthorityServer; Location = compiled.exports.Location; Scripts = compiled.exports.Scripts
})
const digest = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex')
const owner = {data:{joined:true,role:'owner'}}
async function fixture(t, fault = false) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arcanum-scripts-'))
  await fs.cp(path.join(root,'examples/inventory-workshop/data'), directory, {recursive:true})
  if (fault) {
    const manifestPath = path.join(directory,'scripts/manifest.json')
    const manifest = JSON.parse(await fs.readFile(manifestPath,'utf8'))
    const entry = manifest.scripts.find(value => value.id === 'workshop:door')
    const code = `module.exports = {id:'workshop:door',name:'Owned failure witness',realm:'server',entryPoints:{0(ctx){
      ctx.shared.variable(0).value = 99; ctx.game.toggleOff({id:${JSON.stringify(NPC_ID)}},true); ctx.ui.message('must roll back');
      ctx.at(9); ctx.game.actions.getStoryState(ctx.localNumber(0)); return {kind:'run-default'}; }}};`
    await fs.writeFile(path.join(directory,'scripts',entry.compiled),code)
    entry.sha256=digest(code)
    await fs.writeFile(manifestPath,JSON.stringify(manifest))
  }
  const server = make({dataPath:directory,mapId:MAP_ID,checkpointPath:path.join(directory,'save.json')})
  await server.loadWorld()
  t.after(async()=>{await server.stop();await fs.rm(directory,{recursive:true,force:true})})
  const messages: {room:string;event:string;payload:unknown}[]=[]
  server.io = {close(callback:()=>void){callback()},to(room:string){return{emit(event:string,payload:unknown){messages.push({room,event,payload})}}}} as unknown as AuthorityServer['io']
  // No HTTP server is needed for deterministic command/tick tests.
  move(server,[10,5])
  return {server,directory,messages,command(type:string,fields:object={}){return server.command(owner,{version:2,id:server.lastCommandId+1,actorId:'0',type,...fields})}}
}
function move(server:AuthorityServer,coordinates:[number,number]) {
  const origin=new Location(server.player.base.location.x,server.player.base.location.y), target=new Location(coordinates)
  server.map.moveEntity(server.player,origin,target); server.player.base.location.set(coordinates)
}

test('attachment recovery preserves all four byte counters and explicit empty slots',()=>{
  const value={elementSize:12,entries:[{slot:19,value:'efcdab89010203044e0b0000'},{slot:1,value:'000000000000000000000000'}]}
  assert.deepEqual(decodeScriptSlots(value),{19:{scriptId:'arcanum:2894',flags:0x89abcdef,counters:[1,2,3,4]},1:{scriptId:null,flags:0,counters:[0,0,0,0]}})
  assert.throws(()=>decodeScriptSlots({elementSize:12,entries:[{slot:36,value:'000000000000000000000000'}]}))
  assert.throws(()=>decodeScriptSlots({elementSize:12,entries:[{slot:1,value:'0000000000000000ffffffff'}]}))
})
test('owned original-style Use commits veto state privately, runs idle timers, and allows the second default action',async t=>{
  const f=await fixture(t), door=f.server.doors.states.get(SCRIPTED_DOOR_ID)!, guide=[...f.server.map.entityManager.entities.values()].find(entity=>entity.sourcePath===NPC_ID)!
  const first=await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  assert.equal(first.ok,true);assert.ok('result' in first && 'defaultAction' in first.result);assert.equal(first.result.defaultAction,'skip');assert.equal(door.open,false);assert.equal(guide.scriptOff,true)
  assert.equal(f.server.scripts.engine.binding(`${SCRIPTED_DOOR_ID}#1`)!.counters[0],1)
  const notices=f.messages.filter(row=>row.event==='authority:presentation')
  assert.equal(notices.length,1);assert.equal(notices[0].room,'authority:owner')
  assert.match((notices[0].payload as {text:string}).text,/refuses/)
  assert.equal(JSON.stringify(f.server.getSnapshot()).includes('workshop:0'),false)
  assert.equal(f.server.movement,null)
  const now=f.server.scriptTickAt
  for(let step=1;step<=4;step++)f.server.advanceSimulation(now+step*250)
  assert.equal(f.messages.filter(row=>row.event==='authority:presentation').length,2)
  const second=await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  assert.equal(second.ok,true);assert.equal(door.open,true);assert.equal(guide.scriptOff,false)
})
test('a named unsupported operation rolls back script globals, Off, messages and the door default',async t=>{
  const f=await fixture(t,true),before=f.server.scripts.snapshot()
  const result=await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  assert.equal(result.ok,false);assert.ok('code' in result && 'message' in result);assert.equal(result.code,'SCRIPT_FAULT');assert.match(result.message,/getStoryState/)
  assert.deepEqual(f.server.scripts.snapshot(),before)
  assert.equal(f.server.doors.states.get(SCRIPTED_DOOR_ID)!.open,false)
  assert.equal(f.messages.some(row=>row.event==='authority:presentation'),false)
})
test('checkpoints atomically retain script data, timers, Off and counters; restoration starts a new presentation epoch',async t=>{
  const f=await fixture(t)
  await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  const saved=f.server.createCheckpoint(),epoch=f.server.scriptEpoch
  assert.equal(saved.version,7);assert.equal(saved.scripts.engine.scheduled.length,1)
  await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  f.server.applyCheckpoint(f.server.validateCheckpoint(saved))
  assert.equal(f.server.scriptEpoch,epoch+1);assert.equal(f.server.scriptSequence,0)
  assert.deepEqual(f.server.scripts.snapshot(),saved.scripts)
  assert.equal(f.server.getSnapshot()!.scriptObjects.find(row=>row.id===NPC_ID)!.off,true)
  assert.equal(f.server.doors.states.get(SCRIPTED_DOOR_ID)!.open,false)
  const invalid=structuredClone(saved);invalid.scripts.engine.off[NPC_ID]='false' as unknown as boolean
  assert.throws(()=>f.server.validateCheckpoint(invalid),{code:'CHECKPOINT_INVALID'})
  const wrongType=structuredClone(saved);wrongType.scripts.engine.off[SCRIPTED_DOOR_ID]=false
  assert.throws(()=>f.server.validateCheckpoint(wrongType),{code:'CHECKPOINT_INVALID'})
  assert.deepEqual(f.server.scripts.snapshot(),saved.scripts)
})
test('idle script time freezes during pause and checkpoint IO without catching up afterward',async t=>{
  const f=await fixture(t);await f.command('use',{targetId:SCRIPTED_DOOR_ID})
  await f.command('pause')
  const clock=f.server.scripts.snapshot().engine.clockMs,now=f.server.scriptTickAt
  f.server.advanceSimulation(now+10000)
  assert.equal(f.server.scripts.snapshot().engine.clockMs,clock)
  await f.command('resume');f.server.checkpointBusy=true;f.server.advanceSimulation(now+11000)
  assert.equal(f.server.scripts.snapshot().engine.clockMs,clock)
  f.server.checkpointBusy=false;f.server.advanceSimulation(now+11050)
  assert.equal(f.server.scripts.snapshot().engine.clockMs,clock+400)
})
const retail=path.join(root,'local-data/scripts/arcanum/dist/manifest.json')
test('local original Bates heartbeat disables guards once, removes only heartbeat and survives restore',{skip:!syncFs.existsSync(retail)},async t=>{
  const server=make({dataPath:path.join(root,'local-data'),initialScriptFlags:{arcanum:{2676:1}}})
  await server.loadWorld();t.after(()=>server.stop())
  const guardId='Bates Mansion Lev 2/Sector/1/1/Npc/83A4A3DE-E89C-4A33-9109-0D83E510A4CF.json'
  const guard=[...server.map.entityManager.entities.values()].find(entity=>entity.sourcePath===guardId)!
  const dialog=server.scripts.engine.binding(`${guardId}#9`)
  for(let n=0;n<8;n++)server.scripts.tick(250,server.player)
  assert.equal(guard.scriptOff,true);assert.equal(server.scripts.engine.binding(`${guardId}#19`)!.scriptId,'')
  assert.deepEqual(server.scripts.engine.binding(`${guardId}#9`),dialog)
  const saved=server.createCheckpoint();server.applyCheckpoint(server.validateCheckpoint(saved))
  for(let n=0;n<8;n++)server.scripts.tick(250,server.player)
  assert.equal(guard.scriptOff,true)
})

test('a default action failure after script commit rolls back counters, custom data, Off and effects', async t => {
  const f = await fixture(t)
  await f.command('use', { targetId: SCRIPTED_DOOR_ID })
  const before = f.server.scripts.snapshot(), messageCount = f.messages.filter(row => row.event === 'authority:presentation').length
  const original = f.server.doors.prepareApply.bind(f.server.doors)
  f.server.doors.prepareApply = (pending, actor) => {
    const prepared = original(pending, actor)
    if (prepared.code !== undefined) return prepared
    return { ...prepared, transaction: {
      apply() { prepared.transaction.apply(); throw new Error('default failed after partial application') },
      rollback() { prepared.transaction.rollback() },
    } }
  }
  const result = await f.command('use', { targetId: SCRIPTED_DOOR_ID })
  assert.equal(result.ok, false); assert.ok('code' in result); assert.equal(result.code, 'SCRIPT_FAULT')
  assert.deepEqual(f.server.scripts.snapshot(), before)
  assert.equal(f.server.doors.states.get(SCRIPTED_DOOR_ID)!.open, false)
  assert.equal(f.messages.filter(row => row.event === 'authority:presentation').length, messageCount)
})

test('later heartbeat faults preserve publication of earlier committed Off changes and expose one diagnostic', async t => {
  const f = await fixture(t)
  const guide = [...f.server.map.entityManager.entities.values()].find(entity => entity.sourcePath === NPC_ID)!
  const secondId = 'test-second-heartbeat-npc'
  f.server.map.entityManager.entities.set(secondId, { id: secondId, sourcePath: secondId, map: f.server.map,
    base: { type: 'Npc', prototype: guide.base.prototype, location: guide.base.location, flags: guide.base.flags } })
  const entries = []
  for (const [id, code] of [
    ['test:good', "ctx.game.toggleOff(ctx.attachee,true); return {kind:'skip-default'}"],
    ['test:bad', "ctx.at(12); ctx.game.actions.getStoryState(ctx.localNumber(0))"],
  ]) {
    const stem = id.split(':')[1], source = `// owned ${id} fixture`, compiled = `module.exports={id:${JSON.stringify(id)},name:'owned',realm:'server',entryPoints:{0(ctx){${code}}}}`
    await fs.writeFile(path.join(f.directory, 'scripts', `${stem}.ts`), source)
    await fs.writeFile(path.join(f.directory, 'scripts', `${stem}.cjs`), compiled)
    entries.push({ id, realm: 'server', source: `${stem}.ts`, compiled: `${stem}.cjs`, sourceSha256: digest(source), sha256: digest(compiled) })
  }
  const manifest = path.join(f.directory, 'scripts', 'heartbeat-manifest.json')
  await fs.writeFile(manifest, JSON.stringify({ apiVersion: 1, scripts: entries }))
  const binding = scriptId => ({ 19: { scriptId, flags: 0, counters: [0, 0, 0, 0] } })
  const scripts = await Scripts.load({ map: f.server.map, player: f.server.player, dataPath: f.directory, manifestPath: manifest,
    bindings: { format: 'openarcanum-script-bindings', version: 1, objects: { [NPC_ID]: binding('test:good'), [secondId]: binding('test:bad') } },
    descriptor: { format: 'openarcanum-script-module', version: 1, manifest: 'scripts/heartbeat-manifest.json', heartbeatScripts: ['test:good', 'test:bad'] }, effects() {} })
  const due = scripts.snapshot(); due.heartbeats.forEach(row => { row.remainingMs = 0 })
  scripts.restore(scripts.prepareRestore(due))
  const diagnostics: unknown[][] = []
  const previous = console.error
  console.error = (...args: unknown[]) => { diagnostics.push(args) }
  try {
    assert.equal(scripts.tick(0, f.server.player), true)
    assert.equal(guide.scriptOff, true)
    assert.equal(scripts.fault?.code, 'UNSUPPORTED_OPERATION')
    assert.match(scripts.fault!.message, /test:bad:12 getStoryState/)
    assert.equal(scripts.tick(250, f.server.player), false)
    assert.equal(diagnostics.length, 1)
    assert.doesNotThrow(() => scripts.prepareRestore(scripts.snapshot()), 'a halted scheduler still produces a valid checkpoint')
  } finally { console.error = previous; scripts.dispose() }
})
