import PhysicsEngine from './PhysicsEngine'
import type { PhysicsOptions, ObjectFilter } from './PhysicsTypes'
import { loadOptionalProvider, type CannonProvider, type CannonWorld, type CannonBody, type CannonBodyOptions } from './OptionalProviders'

/** Optional three dimensional physics adapter. */
export default class CannonPhysicsEngine extends PhysicsEngine {
  world: CannonWorld
  CANNON: CannonProvider
  constructor(options: PhysicsOptions = {}, provider?: CannonProvider) {
    super(options)
    this.CANNON = provider || loadOptionalProvider<CannonProvider>('cannon', ['World', 'NaiveBroadphase', 'Sphere', 'Box', 'Vec3', 'Body', 'Material', 'Cylinder'])
    this.options.dt ||= 1 / 60
    const world = this.world = new this.CANNON.World()
    world.quatNormalizeSkip = 0
    world.quatNormalizeFast = false
    world.gravity.set(0, -10, 0)
    world.broadphase = new this.CANNON.NaiveBroadphase()
  }
  step(dt: number, _objectFilter?: ObjectFilter): void { this.world.step(dt || this.options.dt!) }
  addSphere(radius: number, mass: number): CannonBody {
    const shape = new this.CANNON.Sphere(radius)
    const body = new this.CANNON.Body({ mass, shape })
    body.position.set(0, 0, 0)
    this.world.addBody(body)
    return body
  }
  addBox(x: number, y: number, z: number, mass: number, friction?: number): CannonBody {
    const shape = new this.CANNON.Box(new this.CANNON.Vec3(x, y, z))
    const options: CannonBodyOptions = { mass, shape }
    if (friction !== undefined) options.material = new this.CANNON.Material({ friction })
    const body = new this.CANNON.Body(options)
    body.position.set(0, 0, 0)
    this.world.addBody(body)
    return body
  }
  addCylinder(radiusTop: number, radiusBottom: number, height: number, numSegments: number, mass: number): CannonBody {
    const shape = new this.CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments)
    const body = new this.CANNON.Body({ mass, shape })
    this.world.addBody(body)
    return body
  }
  removeObject(body: CannonBody): void { this.world.removeBody(body) }
}
