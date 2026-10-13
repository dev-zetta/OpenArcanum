const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { before, test } = require('node:test') as typeof import('node:test')
const path = require('node:path') as typeof import('node:path')
const Module = require('node:module') as typeof import('node:module')
const root = path.resolve(__dirname, '../../..')
let serial
before(async () => {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: root, stdin: { contents: `
      export {default as Serializable} from './Serializable.ts';
      export {default as Serializer} from './Serializer.ts';
      export {default as TwoVector} from './TwoVector.ts';
      export {default as ThreeVector} from './ThreeVector.ts';
      export {default as Quaternion} from './Quaternion.ts';
      export {default as PhysicalObject2D} from './PhysicalObject2D.ts';
      export {default as PhysicalObject3D} from './PhysicalObject3D.ts';
      export {default as DynamicObject} from './_DynamicObject.ts';
      export {default as NetworkTransmitter} from '../network/NetworkTransmitter.ts';
      export {default as NetworkMonitor} from '../network/NetworkMonitor.ts';
      export {default as Utils} from '../misc/Utils.ts';
      export {inheritsMultiple} from '../misc/Classes.ts';
    `, resolveDir: path.join(root, '@openarcanum/agate/src/shared/serialize'), sourcefile: 'serialization-tests.ts' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false
  })
  const compiled = new Module(__filename + '.bundle.cjs', module)
  compiled.filename = __filename + '.bundle.cjs'
  compiled.paths = Module._nodeModulePaths(root)
  compiled._compile(result.outputFiles[0].text, compiled.filename)
  serial = compiled.exports
})

test('binary serializer round-trips sorted scalar, UTF-16, nested-class and list fields', () => {
  class Witness extends serial.Serializable {
    static get netScheme() {
      return { title: {type: 'string'}, score: {type: 'int'}, position: {type: 'class'},
        labels: {type: 'list', itemType: 'string'}, samples: {type: 'list', itemType: 'uint8'} }
    }
    constructor() {
      super()
      this.title = 'Арканум ⚙'
      this.score = -512
      this.position = new serial.TwoVector(3.25, -7.5)
      this.labels = ['Steam', 'Магия']
      this.samples = [0, 127, 255]
    }
  }
  const serializer = new serial.Serializer()
  serializer.registerClass(Witness, 77)
  serializer.registerClass(serial.TwoVector)
  const original = new Witness()
  original.classId = 77
  const dry = original.serialize(serializer, {dry: true})
  const encoded = original.serialize(serializer)
  assert.equal(encoded.bufferOffset, dry.bufferOffset)
  assert.equal(encoded.dataBuffer.byteLength, dry.bufferOffset)
  assert.equal(new DataView(encoded.dataBuffer).getUint8(0), 77)
  const decoded = serializer.deserialize(encoded.dataBuffer)
  assert.equal(decoded.byteOffset, encoded.bufferOffset)
  assert.equal(decoded.obj.title, original.title)
  assert.equal(decoded.obj.score, -512)
  assert.deepEqual(decoded.obj.position, original.position)
  assert.deepEqual(decoded.obj.labels, original.labels)
  assert.deepEqual(decoded.obj.samples, original.samples)
})

test('custom fixed-size primitives advance offsets before the following field', () => {
  class Witness extends serial.Serializable {
    static get netScheme() { return {a: {type: 'u16'}, b: {type: 'uint8'}} }
    constructor() { super(); this.a = 513; this.b = 97 }
  }
  const serializer = new serial.Serializer()
  serializer.addCustomType({type: 'u16', BYTES_PER_ELEMENT: 2,
    writeDataView(view, value, offset) { view.setUint16(offset, value) },
    readDataView(view, offset) { return view.getUint16(offset) }})
  serializer.registerClass(Witness, 78)
  const original = new Witness(); original.classId = 78
  const encoded = original.serialize(serializer)
  const decoded = serializer.deserialize(encoded.dataBuffer)
  assert.equal(encoded.bufferOffset, 4)
  assert.equal(decoded.byteOffset, 4)
  assert.equal(decoded.obj.a, 513)
  assert.equal(decoded.obj.b, 97)
})

test('schema sync preserves pruned strings and nested values while copying scalars', () => {
  class Witness extends serial.Serializable {
    static get netScheme() { return {title: {type: 'string'}, value: {type: 'int'}, position: {type: 'class'}} }
  }
  const target = new Witness(), source = new Witness()
  target.title = 'keep'; target.value = 1; target.position = new serial.TwoVector(1, 2)
  source.title = null; source.value = 9; source.position = new serial.TwoVector(9, 9)
  const originalPosition = target.position
  target.syncTo(source)
  assert.equal(target.title, 'keep')
  assert.equal(target.value, 9)
  assert.equal(target.position, originalPosition)
})

test('legacy physics models retain vector copying, angular interpolation and dynamic bounds', () => {
  const a = new serial.PhysicalObject2D(null, {id: 'a'}, {position: new serial.TwoVector(2, 4), angle: 1})
  const b = new serial.PhysicalObject2D(null, {id: 'b'}, {position: new serial.TwoVector(6, 8), angle: 2})
  a.interpolate(b, 0.5)
  assert.deepEqual([a.position.x, a.position.y], [4, 6])
  assert.equal(a.angle, 0.5) // Historical implementation stores the angular delta.
  const raw = new Float32Array(2)
  a.copyVector(new serial.TwoVector(3, 7), raw)
  assert.deepEqual(Array.from(raw), [3, 7])
  const copied = new serial.TwoVector(0, 0)
  a.copyVector(raw, copied)
  assert.deepEqual([copied.x, copied.y], [3, 7])
  const body = new serial.PhysicalObject3D(null, {id: '3d'}, {position: new serial.ThreeVector(1, 2, 3)})
  assert.deepEqual([body.position.x, body.position.y, body.position.z], [1, 2, 3])
  const dynamic = new serial.DynamicObject(null, {id: 'dynamic'}, {width: 4, height: 6, position: new serial.TwoVector(10, 20)})
  assert.deepEqual(dynamic.getAABB(), {min: [8, 17], max: [12, 23]})
})

test('network collections round-trip event tags, schemas and nested objects', () => {
  const serializer = new serial.Serializer()
  serializer.registerClass(serial.TwoVector)
  const transmitter = new serial.NetworkTransmitter(serializer)
  assert.equal(transmitter.serializePayload(), null)
  transmitter.addNetworkedEvent('syncHeader', {stepCount: 42, fullUpdate: 1})
  transmitter.addNetworkedEvent('objectUpdate', {stepCount: 42, objectInstance: new serial.TwoVector(7.5, -2)})
  const encoded = transmitter.serializePayload()
  assert.equal(encoded.bufferOffset, encoded.dataBuffer.byteLength)
  const decoded = transmitter.deserializePayload(encoded)
  assert.equal(decoded.events.length, 2)
  assert.equal(decoded.events[0].eventName, 'syncHeader')
  assert.equal(decoded.events[0].stepCount, 42)
  assert.equal(decoded.events[0].fullUpdate, 1)
  assert.equal(decoded.events[1].eventName, 'objectUpdate')
  assert.deepEqual(decoded.events[1].objectInstance, new serial.TwoVector(7.5, -2))
  // Deserialized wire events retain the actual serializer API.
  assert.equal(typeof decoded.events[0].serialize, 'function')
  assert.throws(() => transmitter.deserializePayload({dataBuffer: 'invalid'}), /no binary buffer/)
  transmitter.clearPayload()
  assert.equal(transmitter.serializePayload(), null)
})

test('network monitor averages recent RTT responses and ignores unknown or replayed replies', () => {
  let timestamp = 100
  const originalPerformance = serial.Utils.performance
  serial.Utils.performance = {now: () => timestamp}
  const handlers = new Map<string, (id: number) => void>()
  const emitted: [string, number][] = []
  const socket = {on(event, handler) {handlers.set(event, handler)}, emit(event, id) {emitted.push([event, id])}}
  const monitor = new serial.NetworkMonitor()
  const updates: {RTT: number; RTTAverage: number}[] = []
  monitor.events.on('RTTUpdate', value => updates.push(value))
  try {
    monitor.registerClient({socket, options: {healthCheckRTTSample: 2, healthCheckInterval: 60_000}})
    for (const duration of [10, 30, 50]) {
      monitor.sendRTTQuery()
      timestamp += duration
      handlers.get('RTTResponse')!(emitted.at(-1)![1])
    }
    handlers.get('RTTResponse')!(999)
    handlers.get('RTTResponse')!(2)
    assert.deepEqual(updates, [{RTT: 10, RTTAverage: 10}, {RTT: 30, RTTAverage: 20}, {RTT: 50, RTTAverage: 40}])
    assert.deepEqual(monitor.RTTQueries, {})
    monitor.registerPlayerOnServer(socket)
    handlers.get('RTTQuery')!(17)
    assert.deepEqual(emitted.at(-1), ['RTTResponse', 17])
  } finally {
    monitor.close()
    serial.Utils.performance = originalPerformance
  }
})

test('multiple inheritance keeps parent lookup order and constructor argument groups', () => {
  class Base {declare base: string; declare shared: string; constructor(value: string) {this.base = value; this.shared = 'base'} baseMethod() {return this.base}}
  class First {declare first: string; declare shared: string; constructor(value: string) {this.first = value; this.shared = 'first'} describe() {return 'first'}}
  class Second {declare second: string; declare shared: string; constructor(value: string) {this.second = value; this.shared = 'second'} describe() {return 'second'} secondMethod() {return this.second}}
  const Combined = serial.inheritsMultiple(Base, [First, Second])
  const value = new Combined(['B'], [['F'], ['S']])
  assert.deepEqual([value.base, value.first, value.second, value.shared], ['B', 'F', 'S', 'base'])
  assert.equal(value.baseMethod(), 'B')
  assert.equal(value.describe(), 'first')
  assert.equal(value.secondMethod(), 'S')
  assert.equal('secondMethod' in value, true)
})
