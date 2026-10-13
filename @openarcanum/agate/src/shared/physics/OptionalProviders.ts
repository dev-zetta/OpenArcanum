export interface P2Shape { type: number }
export interface P2Body { addShape(shape: P2Shape): void; position: number[]; mass: number }
export interface P2World { step(dt: number): void; addBody(body: P2Body): void; removeBody(body: P2Body): void }
export interface P2Provider {
  World: new(options: { gravity: [number, number] }) => P2World
  Body: new(options: { mass: number; position: [number, number] }) => P2Body
  Circle: new(options: { radius: number }) => P2Shape
  Box: new(options: { width: number; height: number }) => P2Shape
}
export interface CannonVector { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
export interface CannonShape { type: number }
export interface CannonMaterial { friction: number }
export interface CannonBody { position: CannonVector; mass: number }
export interface CannonBodyOptions { mass: number; shape: CannonShape; material?: CannonMaterial }
export interface CannonWorld {
  quatNormalizeSkip: number; quatNormalizeFast: boolean; gravity: CannonVector; broadphase: unknown
  step(dt: number): void; addBody(body: CannonBody): void; removeBody(body: CannonBody): void
}
export interface CannonProvider {
  World: new() => CannonWorld
  NaiveBroadphase: new() => unknown
  Sphere: new(radius: number) => CannonShape
  Box: new(size: CannonVector) => CannonShape
  Vec3: new(x: number, y: number, z: number) => CannonVector
  Body: new(options: CannonBodyOptions) => CannonBody
  Material: new(options: { friction: number }) => CannonMaterial
  Cylinder: new(radiusTop: number, radiusBottom: number, height: number, numSegments: number) => CannonShape
}

/** These optional engines stay unloadable until selected. A mod may inject a
 * compatible provider; Node users may install the original package locally. */
export function loadOptionalProvider<T>(name: string, constructors: readonly string[]): T {
  if (typeof require !== 'function') throw new Error(`Optional physics provider ${name} must be injected outside the Node runtime.`)
  const loadModule: NodeRequire = require
  let candidate: unknown
  try { candidate = loadModule(name) } catch (error) {
    throw new Error(`Optional physics provider ${name} is unavailable. Inject a compatible provider or install it locally.`, { cause: error })
  }
  if (!candidate || typeof candidate !== 'object' || constructors.some(key => typeof Reflect.get(candidate, key) !== 'function')) {
    throw new Error(`Optional physics provider ${name} does not expose the required constructors.`)
  }
  return candidate as T
}
