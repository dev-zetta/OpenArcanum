//https://itnext.io/multiple-inheritance-in-js-part-2-24adca2c2518
//https://gist.github.com/zhirzh/fbfe28ca0f33f14f22a025c914f1d0e3

function inheritsObject(baseObject, superObject) {
  Object.setPrototypeOf(baseObject, superObject)
}

function inheritsMultipleObjects(baseObject, superObjects) {
  inheritsObject(
    baseObject,

    new Proxy(
      {},
      {
        get(target, key, rec) {
          const parent = superObjects.find((p) => Reflect.has(p, key))

          if (parent !== undefined) {
            return Reflect.get(parent, key)
          }

          return undefined
        },

        has(target, key) {
          const parentHasKey = superObjects.some((p) => Reflect.has(p, key))

          if (parentHasKey) {
            return true
          }

          return false
        }
      }
    )
  )
}

function inheritsMultipleConstructors(BaseCtor, SuperCtors) {
  return new Proxy(BaseCtor, {
    construct(_, [baseArgs = [], superArgs = []], newTarget) {
      let instance = {}

      instance = SuperCtors.reduce((acc, Ctor, i) => {
        const args = superArgs[i] || []
        return Object.assign(acc, new Ctor(...args))
      }, instance)

      instance = Object.assign(instance, new BaseCtor(...baseArgs))

      inheritsObject(instance, newTarget.prototype)
      return instance
    }
  })
}

export const inheritsMultiple = (BaseCtor, SuperCtors) => {
  inheritsMultipleObjects(
    BaseCtor.prototype,
    SuperCtors.map(Ctor => Ctor.prototype)
  )

  return inheritsMultipleConstructors(BaseCtor, SuperCtors)
}
