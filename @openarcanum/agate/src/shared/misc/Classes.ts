// Retained multiple-inheritance helper; prototype lookup follows parent order.
type Constructor = {new (...args: never[]): object; prototype: object}
type UnionToIntersection<Value> = (Value extends unknown ? (value: Value) => void : never) extends ((value: infer Result) => void) ? Result : never
type Combined<Base extends Constructor, Supers extends readonly Constructor[]> =
  new (baseArgs?: ConstructorParameters<Base>, superArgs?: {[Index in keyof Supers]?: ConstructorParameters<Supers[Index]>}) =>
    InstanceType<Base> & UnionToIntersection<InstanceType<Supers[number]>>
function inheritsObject(base: object, parent: object): void { Object.setPrototypeOf(base, parent) }
function inheritsMultipleObjects(base: object, parents: readonly object[]): void {
  inheritsObject(base, new Proxy({}, {
    get(_target, key) { const parent = parents.find(candidate => Reflect.has(candidate, key)); return parent === undefined ? undefined : Reflect.get(parent, key) },
    has(_target, key) { return parents.some(candidate => Reflect.has(candidate, key)) }
  }))
}
export function inheritsMultiple<Base extends Constructor, Supers extends readonly Constructor[]>(BaseCtor: Base, SuperCtors: Supers): Combined<Base, Supers> {
  inheritsMultipleObjects(BaseCtor.prototype, SuperCtors.map(Ctor => Ctor.prototype))
  return new Proxy(BaseCtor, {
    construct(_target, args: unknown[], newTarget) {
      const [baseArgs = [], superArgs = []] = args as [unknown[]?, unknown[][]?]
      const instance = SuperCtors.reduce<object>((value, Ctor, index) => Object.assign(value, Reflect.construct(Ctor, superArgs[index] || []) as object), {})
      Object.assign(instance, Reflect.construct(BaseCtor, baseArgs) as object)
      inheritsObject(instance, Reflect.get(newTarget, 'prototype') as object)
      return instance
    }
  }) as unknown as Combined<Base, Supers>
}
