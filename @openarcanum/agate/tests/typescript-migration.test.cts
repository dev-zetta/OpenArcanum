import type GameEngine from "../dist-types/shared/GameEngine"
import type GameMap from "../dist-types/shared/map/GameMap"
import type { SpatialObject } from "../dist-types/shared/physics/SimplePhysics/HSHG"
import type { P2Provider, CannonProvider, CannonBodyOptions } from "../dist-types/shared/physics/OptionalProviders"
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const { build }: typeof import('esbuild') = require('esbuild')
const path: typeof import('node:path') = require('node:path')
const Module: typeof import('node:module') = require('node:module')
const { EventEmitter }: typeof import('node:events') = require('node:events')

type Modules = {
  Manager: typeof import("../dist-types/shared/entity/Manager").default
  ObjectPool: typeof import("../dist-types/shared/entity/ObjectPool").default
  AiState: typeof import("../dist-types/shared/entity/ai/State").default
  KDTree: typeof import("../dist-types/shared/misc/KDTree").default
  HSHG: typeof import("../dist-types/shared/physics/SimplePhysics/HSHG").default
  P2PhysicsEngine: typeof import("../dist-types/shared/physics/P2PhysicsEngine").default
  CannonPhysicsEngine: typeof import("../dist-types/shared/physics/CannonPhysicsEngine").default
}
let runtime: Modules
before(async () => {
  const root = path.resolve(__dirname, '../../..')
  const source = path.join(root, '@openarcanum/agate/src')
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: `
      export {default as Manager} from './shared/entity/Manager.ts';
      export {default as ObjectPool} from './shared/entity/ObjectPool.ts';
      export {default as AiState} from './shared/entity/ai/State.ts';
      export {default as KDTree} from './shared/misc/KDTree.ts';
      export {default as HSHG} from './shared/physics/SimplePhysics/HSHG.ts';
      export {default as P2PhysicsEngine} from './shared/physics/P2PhysicsEngine.ts';
      export {default as CannonPhysicsEngine} from './shared/physics/CannonPhysicsEngine.ts';
    `, resolveDir: source, sourcefile: 'typescript-migration-tests.ts', loader: 'ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false,
    external: ['electron', 'workerpool'], loader: { '.glsl': 'text' }
  })
  const compiled = new Module(path.join(__dirname, 'typescript-migration-bundle.cjs'), module)
  compiled.filename = path.join(__dirname, 'typescript-migration-bundle.cjs')
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  runtime = compiled.exports as Modules
})

function managerFixture() {
  const events = new EventEmitter()
  // The renderer, archive loader and simulation clock are outside these tests.
  const game = { options: { headless: true }, events, assetLoader: {
    async loadJsonFile() { return { Base: { type: 'Generic', prototype: 1, location: [0, 0] }, Generic: { flags: [] } } }
  } } as unknown as GameEngine
  return { manager: new runtime.Manager(game), events }
}

test('ECS tag and component indexes follow removal and pooled entity reuse', async () => {
  const { manager, events } = managerFixture()
  await manager.loadPrototype('1', 'fixture.json')
  const first = await manager.newEntity('first', { Base: { prototype: 1 } })
  const second = await manager.newEntity('second', { Base: { prototype: 1 } })
  // Mutable defaults require an owned wrapper even when the raw entity omits
  // them; otherwise one instance can alter a sibling or its prototype.
  assert.notEqual(first.base.location, second.base.location)
  assert.notEqual(first.generic!.flags, second.generic!.flags)
  first.map = { world: { events } } as unknown as GameMap
  const updates: unknown[] = []
  events.on('Object:Update', entity => updates.push(entity))
  first.base.location.x = 17
  assert.equal(second.base.location.x, 0)
  assert.equal(manager.prototypes.get('1')!.base.location.x, 0)
  first.addTag('owned')
  first.addTag('owned')
  assert.deepEqual(manager.queryTag('owned'), [first])
  assert.deepEqual(first.tags, ['owned'])
  assert.deepEqual(manager.queryComponents(['base', 'generic']), [first, second])
  first.removeTag('owned')
  assert.deepEqual(manager.queryTag('owned'), [])
  assert.deepEqual(first.tags, [])
  manager.removeEntity(first)
  assert.deepEqual(manager.queryComponents(['base', 'generic']), [second])
  assert.equal(manager.dirtyEntities.has('first'), false)
  const updatesBeforeReuse = updates.length
  const reused = await manager.newEntity('reused', { Base: { prototype: 1 } })
  assert.equal(reused, first)
  assert.deepEqual(manager.queryComponents(['base', 'generic']), [second, reused])
  assert.deepEqual(reused.tags, [])
  assert.deepEqual(reused.base.location.toPlainObject(), { x: 0, y: 0 })
  assert.equal(updates.length, updatesBeforeReuse, 'pool initialization does not publish old-owner changes')
  assert.equal(manager.poolStats().entity.used, 2)
})

test('prototype nested writes keep siblings independent and publish the component path', async () => {
  const { manager, events } = managerFixture()
  await manager.loadPrototype('1', 'fixture.json')
  const first = await manager.newEntity('first', { Base: { prototype: 1, location: [3, 4] } })
  const second = await manager.newEntity('second', { Base: { prototype: 1, location: [8, 9] } })
  first.map = { world: { events } } as unknown as GameMap
  const updates: unknown[] = []
  events.on('Object:Update', entity => updates.push(entity))
  first.base.location.x = 11
  assert.equal(first.base.location.x, 11)
  assert.equal(second.base.location.x, 8)
  assert.equal(manager.prototypes.get('1')!.base.location.x, 0)
  assert.equal(updates.length, 1)
  assert.deepEqual(first.getUpdateState().base, { location: { x: 11 } })
})

test('object pool forwards constructor arguments and initializes reused objects', () => {
  class Pooled { declare prefix: string;  value = 0; constructor(prefix: string) { this.prefix = prefix; } init(data: { value: number }) { this.value = data.value } }
  const pool = new runtime.ObjectPool(Pooled, 'owned')
  const first = pool.aquire({ value: 7 })
  assert.equal(first.prefix, 'owned')
  assert.equal(first.value, 7)
  pool.release(first)
  const second = pool.aquire({ value: 12 })
  assert.equal(second, first)
  assert.equal(second.value, 12)
  assert.equal(pool.totalUsed(), 1)
})

test('AI flags keep independent timestamps and action state across clear', () => {
  const state = new runtime.AiState()
  const { Moving, Attacking } = runtime.AiState.Flags
  assert.equal(state.has(Moving), false)
  state.set([Moving, Attacking])
  assert.equal(state.hasAny([Moving, Attacking]), true)
  assert.equal(state.getElapsed(Moving) >= 0, true)
  state.remove(Moving)
  assert.deepEqual(state.getMissing([Moving, Attacking]), [Moving])
  state.clear()
  assert.equal(state.has(Attacking), false)
  assert.equal(state.counter, 0)
  assert.equal(state.actions.size, 0)
})

test('KD spatial queries match direct geometry across partition sizes', () => {
  const points = Array.from({ length: 1000 }, (_, i) => [(i * 173 % 997) - 500, (i * 89 % 991) - 500])
  for (const size of [1, 8, 64]) {
    const tree = new runtime.KDTree(size)
    tree.setPoints(points)
    tree.sort()
    for (let i = 0; i < 30; i++) {
      const x = i * 29 % 701 - 350, y = i * 31 % 701 - 350, radius = 1 + i % 113
      const range = points.flatMap((p, index) => p[0] >= x - radius && p[0] <= x + radius && p[1] >= y - radius && p[1] <= y + radius ? [index] : [])
      const within = points.flatMap((p, index) => (p[0] - x) ** 2 + (p[1] - y) ** 2 <= radius ** 2 ? [index] : [])
      assert.deepEqual(tree.range(x - radius, y - radius, x + radius, y + radius).sort((a, b) => a - b), range)
      assert.deepEqual(tree.within(x, y, radius).sort((a, b) => a - b), within)
    }
  }
})

test('hierarchical collision grid matches direct overlap after motion and removal', () => {
  interface Box extends SpatialObject { id: number; x: number; y: number; size: number }
  const objects: Box[] = Array.from({ length: 80 }, (_, id) => ({ id, x: id * 37 % 61 - 30, y: id * 19 % 67 - 33, size: 1 + id % 9,
    getAABB() { return { min: [this.x, this.y], max: [this.x + this.size, this.y + this.size] } } }))
  const grid = new runtime.HSHG<Box>()
  for (const object of objects) grid.addObject(object)
  const overlap = (a: Box, b: Box) => a.x <= b.x + b.size && b.x <= a.x + a.size && a.y <= b.y + b.size && b.y <= a.y + a.size
  const verify = () => {
    const expected = objects.flatMap((a, i) => objects.slice(i + 1).flatMap(b => overlap(a, b) ? [`${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`] : [])).sort()
    const actual = [...new Set(grid.queryForCollisionPairs().map(([a, b]) => `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`))].sort()
    assert.deepEqual(actual, expected)
  }
  verify()
  for (const object of objects) { object.x += object.id % 3 - 1; object.y += object.id % 5 - 2 }
  grid.update()
  verify()
  for (let i = 0; i < 10; i++) grid.removeObject(objects.pop()!)
  verify()
})

const physicsContext = { world: { objects: {} }, worldSettings: { width: 100, height: 100 }, events: { on() {}, emit() {} } }
test('injected p2 provider receives shape and clock calls', () => {
  const steps: number[] = []
  class World { bodies: Body[] = []; step(dt: number) { steps.push(dt) } addBody(body: Body) { this.bodies.push(body) } removeBody(body: Body) { this.bodies.splice(this.bodies.indexOf(body), 1) } }
  class Body { position: number[]; mass: number; shapes: unknown[] = []; constructor(options: { mass: number; position: number[] }) { this.position = options.position; this.mass = options.mass } addShape(shape: unknown) { this.shapes.push(shape) } }
  class Circle { declare options: { radius: number };  type = 1; constructor(options: { radius: number }) { this.options = options; } }
  class Box { declare options: { width: number; height: number };  type = 2; constructor(options: { width: number; height: number }) { this.options = options; } }
  const provider: P2Provider = { World, Body, Circle, Box }
  const physics = new runtime.P2PhysicsEngine({ gameEngine: physicsContext }, provider)
  const circle = physics.addCircle(3, 7), box = physics.addBox(4, 5, 2)
  physics.step(0)
  physics.step(0.1)
  assert.deepEqual(steps, [1 / 60, 0.1])
  assert.equal(circle.mass, 7)
  assert.equal(box.mass, 2)
  physics.removeObject(circle)
  assert.deepEqual((physics.world as World).bodies, [box])
})

test('optional Cannon provider preserves gravity, shape and material arguments', () => {
  class Vec3 { declare z: number;  declare y: number;  declare x: number;  constructor(x = 0, y = 0, z = 0) { this.z = z;  this.y = y;  this.x = x; } set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z } }
  class World { quatNormalizeSkip = 0; quatNormalizeFast = false; gravity = new Vec3(); broadphase: unknown; bodies: Body[] = []; step(_dt: number) {} addBody(body: Body) { this.bodies.push(body) } removeBody(body: Body) { this.bodies.splice(this.bodies.indexOf(body), 1) } }
  class Body { declare options: CannonBodyOptions;  position = new Vec3(); mass: number; constructor(options: CannonBodyOptions) { this.options = options;  this.mass = options.mass } }
  class Sphere { declare radius: number;  type = 1; constructor(radius: number) { this.radius = radius; } }
  class Box { declare size: Vec3;  type = 2; constructor(size: Vec3) { this.size = size; } }
  class Cylinder { declare segments: number;  declare height: number;  declare radiusBottom: number;  declare radiusTop: number;  type = 3; constructor(radiusTop: number, radiusBottom: number, height: number, segments: number) { this.segments = segments;  this.height = height;  this.radiusBottom = radiusBottom;  this.radiusTop = radiusTop; } }
  class Material { friction: number; constructor(options: { friction: number }) { this.friction = options.friction } }
  const provider: CannonProvider = { World, NaiveBroadphase: class {}, Sphere, Box, Vec3, Body, Material, Cylinder }
  const physics = new runtime.CannonPhysicsEngine({ gameEngine: physicsContext }, provider)
  const box = physics.addBox(1, 2, 3, 5, 0.4) as Body
  assert.deepEqual([physics.world.gravity.x, physics.world.gravity.y, physics.world.gravity.z], [0, -10, 0])
  assert.equal(box.options.material!.friction, 0.4)
  assert.deepEqual((box.options.shape as Box).size, new Vec3(1, 2, 3))
  assert.equal(physics.addSphere(7, 2).mass, 2)
  assert.equal(physics.addCylinder(1, 2, 3, 4, 6).mass, 6)
  physics.removeObject(box)
  assert.equal((physics.world as World).bodies.length, 2)
})
