import type { TestContext } from 'node:test'
import type { createAuthorityServer as CreateServer } from '../dist-types/server/authority/AuthorityServer'
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const { io } = require('socket.io-client') as typeof import('socket.io-client')
const { MAP_ID, BOX_ID, TOKEN_ID, BALLAST_BOX_ID, BALLAST_ID, PROGRESSION_BASELINE } = require('../../../examples/inventory-workshop/generate.cts')
const root = path.resolve(__dirname, '../../..')
let createServer: typeof CreateServer
before(async () => {
  const { build } = await import('esbuild')
  const result = await build({ absWorkingDir: root,
    stdin: { contents: "export {createAuthorityServer} from './server/authority/AuthorityServer.ts'",
      resolveDir: path.join(root, '@openarcanum/agate/src'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' } })
  const compiled = new Module(path.join(__dirname, 'carrying-network-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'carrying-network-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  createServer = compiled.exports.createAuthorityServer
})

async function fixture(t: TestContext) {
  const dataPath = await fs.mkdtemp(path.join(os.tmpdir(), 'agate-carrying-network-'))
  await fs.cp(path.join(root, 'examples/inventory-workshop/data'), dataPath, { recursive: true })
  const checkpointPath = path.join(dataPath, 'capacity-save.json')
  const hosts: ReturnType<typeof CreateServer>[] = [], sockets: ReturnType<typeof io>[] = []
  t.after(async () => {
    sockets.forEach(socket => socket.disconnect())
    for (const server of hosts.reverse()) await server.stop()
    await fs.rm(dataPath, { recursive: true, force: true })
  })
  async function start() {
    const server = createServer({ dataPath, mapId: MAP_ID, checkpointPath, tickMs: 20 })
    hosts.push(server)
    const session = await server.start()
    let nextId = 1
    async function connect(role: 'owner' | 'observer' = 'owner') {
      const socket = io(session.url, { transports: ['websocket'], reconnection: false, forceNew: true,
        autoConnect: false, auth: { version: 1, token: role === 'owner' ? session.ownerToken : session.observerToken } })
      sockets.push(socket)
      const snapshots: unknown[] = []
      socket.on('authority:snapshot', snapshot => snapshots.push(snapshot))
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect()
      })
      const joined = await socket.timeout(3000).emitWithAck('authority:join', { version: 1 })
      assert.equal(joined.ok, true)
      const request = (type: string, fields = {}) => socket.timeout(3000).emitWithAck('authority:command',
        { version: 1, id: nextId++, actorId: '0', type, ...fields })
      return { socket, snapshots, request }
    }
    const owner = await connect()
    const approach = async (targetId: string) => {
      const result = await owner.request('use', { targetId })
      assert.equal(result.ok, true, result.message)
      // Exercise the real movement completion code with a controlled server clock.
      if (server.movement) server.advanceMovement(server.movement.startedAt + 120000)
      assert.equal(server.movement, null)
      const inspected = await owner.request('inspect', { targetId })
      assert.equal(inspected.ok, true, inspected.message)
      return inspected
    }
    const transfer = (type: string, targetId: string, itemId?: string) => owner.request(type,
      { targetId, ...(itemId ? { itemId } : {}), expectedRevision: server.revision })
    const buy = () => owner.request('buy-attribute', { statId: 'strength', expectedRevision: server.revision })
    const inventory = async () => (await owner.request('inventory')).result
    return { server, owner, connect, approach, transfer, buy, inventory }
  }
  return { dataPath, checkpointPath, start, ...(await start()) }
}

test('loopback capacity accepts exact weight, rejects whole overweight batches and applies Strength privately', async t => {
  const context = await fixture(t), observer = await context.connect('observer')
  const { server, owner, approach, transfer, inventory, buy } = context
  assert.deepEqual((await inventory()).carrying, { supported: true, weight: 0, capacity: 4000, encumbrance: 'none' })
  await approach(BALLAST_BOX_ID)
  const exact = await transfer('take', BALLAST_BOX_ID, BALLAST_ID)
  assert.equal(exact.ok, true, exact.message)
  assert.deepEqual(exact.result.inventory.carrying, { supported: true, weight: 4000, capacity: 4000, encumbrance: 'severe' })
  assert.equal(exact.result.inventory.items[0].weight, 4000)
  await approach(BOX_ID)
  const before = server.ownership.checkpointStates(), revision = server.revision
  for (const type of ['take', 'take-all']) {
    const rejected = await transfer(type, BOX_ID, type === 'take' ? TOKEN_ID : undefined)
    assert.equal(rejected.code, 'TOO_HEAVY')
    assert.equal(server.revision, revision)
    assert.deepEqual(server.ownership.checkpointStates(), before)
  }
  const purchase = await buy()
  assert.equal(purchase.ok, true, purchase.message)
  assert.equal(purchase.result.inventory.carrying.capacity, 4500)
  assert.equal(purchase.result.inventory.carrying.weight, 4000)
  const accepted = await transfer('take-all', BOX_ID)
  assert.equal(accepted.ok, true, accepted.message)
  assert.deepEqual(accepted.result.inventory.carrying, { supported: true, weight: 4001, capacity: 4500, encumbrance: 'heavy' })
  assert.equal((await observer.request('inventory')).code, 'FORBIDDEN')
  assert.equal((await observer.request('buy-attribute', { statId: 'strength', expectedRevision: server.revision })).code, 'FORBIDDEN')
  await owner.request('character')
  await new Promise(resolve => setTimeout(resolve, 30))
  for (const snapshot of observer.snapshots) {
    const publicJson = JSON.stringify(snapshot)
    assert.doesNotMatch(publicJson, /"(?:weight|capacity|carrying|encumbrance|inventory|items|attributes)":/)
    assert.equal(publicJson.includes(BALLAST_ID), false)
    assert.equal(publicJson.includes(TOKEN_ID), false)
  }
})

test('checkpoint load validates saved Strength rather than live Strength and recomputes weight across restart', async t => {
  const context = await fixture(t)
  const { server, owner, approach, transfer, buy, inventory, checkpointPath } = context
  const baseline = server.createCheckpoint()
  await approach(BALLAST_BOX_ID)
  assert.equal((await transfer('take', BALLAST_BOX_ID, BALLAST_ID)).ok, true)
  assert.equal((await buy()).ok, true)
  await approach(BOX_ID)
  assert.equal((await transfer('take', BOX_ID, TOKEN_ID)).ok, true)
  const strong = server.createCheckpoint()
  const forged = JSON.parse(JSON.stringify(strong))
  forged.character = { ...PROGRESSION_BASELINE, attributes: { ...PROGRESSION_BASELINE.attributes }, history: [] }
  const before = await inventory(), state = server.progression.checkpointState()
  await fs.writeFile(checkpointPath, JSON.stringify(forged))
  assert.equal((await owner.request('load')).code, 'CHECKPOINT_INVALID', 'live ST9 cannot legitimize saved ST8 carrying 4001')
  assert.deepEqual(await inventory(), before)
  assert.deepEqual(server.progression.checkpointState(), state)
  await fs.writeFile(checkpointPath, JSON.stringify(baseline))
  assert.equal((await owner.request('load')).ok, true)
  assert.equal((await inventory()).carrying.capacity, 4000)
  await fs.writeFile(checkpointPath, JSON.stringify(strong))
  assert.equal((await owner.request('load')).ok, true, 'saved ST9 is restored before evaluating its 4001-stone inventory')
  assert.equal((await inventory()).carrying.weight, 4001)
  await server.stop()
  const fresh = await context.start()
  assert.equal((await fresh.owner.request('load')).ok, true)
  assert.deepEqual((await fresh.inventory()).carrying, { supported: true, weight: 4001, capacity: 4500, encumbrance: 'heavy' })
})

test('failed private weight view rolls back a Strength purchase and its Character Point', async t => {
  const { server, buy } = await fixture(t)
  const before = server.progression.checkpointState(), revision = server.revision
  const read = server.ownership.actorInventory
  server.ownership.actorInventory = () => ({ code: 'INVENTORY_UNAVAILABLE', message: 'Synthetic weight metadata failure' })
  assert.equal((await buy()).code, 'INVENTORY_UNAVAILABLE')
  server.ownership.actorInventory = read
  assert.deepEqual(server.progression.checkpointState(), before)
  assert.equal(server.revision, revision)
})
