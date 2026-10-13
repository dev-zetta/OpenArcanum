import PhysicsEngine from './PhysicsEngine'
import type { PhysicsOptions, ObjectFilter } from './PhysicsTypes'
import { loadOptionalProvider, type P2Provider, type P2World, type P2Body } from './OptionalProviders'

/** Optional two dimensional physics adapter. */
export default class P2PhysicsEngine extends PhysicsEngine {
  world: P2World
  p2: P2Provider
  constructor(options: PhysicsOptions = {}, provider?: P2Provider) {
    super(options)
    this.p2 = provider || loadOptionalProvider<P2Provider>('p2', ['World', 'Body', 'Circle', 'Box'])
    this.options.dt ||= 1 / 60
    this.world = new this.p2.World({ gravity: [0, 0] })
  }
  step(dt: number, _objectFilter?: ObjectFilter): void { this.world.step(dt || this.options.dt!) }
  addCircle(radius: number, mass: number): P2Body {
    const body = new this.p2.Body({ mass, position: [0, 0] })
    body.addShape(new this.p2.Circle({ radius }))
    this.world.addBody(body)
    return body
  }
  addBox(width: number, height: number, mass: number): P2Body {
    const body = new this.p2.Body({ mass, position: [0, 0] })
    body.addShape(new this.p2.Box({ width, height }))
    this.world.addBody(body)
    return body
  }
  removeObject(body: P2Body): void { this.world.removeBody(body) }
}
