import MovementPath from '../MovementPath'
interface MovableMethods { movementPath: MovementPath; foo(): void }
type Constructor = new(...args: never[]) => object
export default function Movable<C extends Constructor>(superclass: C) {
  const Base = superclass as unknown as new(...args: unknown[]) => { foo?(): void }
  class MovableMixin extends Base implements MovableMethods {
    movementPath = new MovementPath()
    foo(): void { console.log('foo from Mixin1'); super.foo?.() }
  }
  return MovableMixin as unknown as C & { new(...args: ConstructorParameters<C>): InstanceType<C> & MovableMethods }
}
