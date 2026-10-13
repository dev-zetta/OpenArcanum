import type { PhysicsOptions, PhysicsGameEngine, ObjectFilter } from './PhysicsTypes'

// Common interface for the optional local physics implementations.
export default class PhysicsEngine {
  options: PhysicsOptions
  gameEngine?: PhysicsGameEngine
  constructor(options: PhysicsOptions = {}) {
    this.options = options
    this.gameEngine = options.gameEngine
    if (!this.gameEngine) console.warn('Physics engine initialized without gameEngine!')
  }
  step(_dt: number, _objectFilter: ObjectFilter): void {}
}
