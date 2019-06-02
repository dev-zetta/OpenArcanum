import Flags from '../Flags'
import Components from './components'

import ECS from '../../libs/ECS'
import Entity from './Entity'

const ClassTransformer = require(`class-transformer`)

export default class Prototype extends ECS.Entity {
  constructor() {
    super()
  }

  /**
   *
   * @param data
   * @returns {*}
   */
  static createComponentsFromData(data, onComponent = null) {
    let components = {}

    for (let key in data) {
      let component = Components[key]

      if (!component) {
        AGate.Utils.logError(`Unknown component: ${key}`)
        continue
      }

      let instance = ClassTransformer.plainToClass(component, data[key])

      if (instance.flags) {
        instance.flags = new Flags(instance.flags)
      }

      if (onComponent) {
        onComponent(instance)
      } else {
        components[Prototype.componentInstanceToName(instance)] = instance
      }
    }

    return components
  }

  /**
   *
   * @param data
   * @returns {*}
   */
  static fromData(data) {
    let prototype = new Prototype()

    Prototype.createComponentsFromData(data, (component) => {
      prototype.addComponent(component)
    })

    return prototype
  }

  static wrapObjectToProxy(source, prototype, parent = source) {
    if (source !== parent) {
      for (let key in source) {
        let value = source[key]
        if (typeof value === `object` && value != null && prototype != null) {
          source[key] = Prototype.wrapObjectToProxy(
            value,
            prototype[key],
            source
          )
        }
      }
    }

    let handler = {
      get(obj, prop) {
        if (obj[prop] !== undefined) {
          return obj[prop]
        }

        if (prototype) {
          return prototype[prop]
        }

        return undefined
      },

      set(obj, prop, value) {
        if (typeof value === `object` && value != null && prototype != null) {
          obj[prop] = Prototype.wrapObjectToProxy(value, prototype[prop], obj)
        } else {
          obj[prop] = value
        }

        return true
      }
    }

    let result = new Proxy(source, handler)
    return result
  }

  createEntity(engine, data) {
    let entity = new Entity(engine)
    Prototype.createComponentsFromData(data, (component) => {
      entity.addComponent(component)
    })

    return Prototype.wrapObjectToProxy(entity, this)
  }

  /**
   *
   * @param entity
   */
  copyToEntity(entity, source = null) {
    let prototype = source || this

    for (let key in prototype) {
      let value = prototype[key]

      if (AGate.Utils.isPlainObject(value)) {
        if (!entity[key]) {
          entity[key] = {}
        }

        this.copyToEntity(entity[key], value)
      } else if (AGate.Utils.isArray(value)) {
        // Merge array
        if (!entity[key]) {
          entity[key] = prototype[key].slice(0)
        } else {
          // merge unique
          let current = entity[key]
          for (let val of value) {
            // Is not number and is already in array?
            if (!AGate.Utils.isNumber(val)) {
              if (current.indexOf(val) !== -1) {
                current.push(val)
              }
            }
          }
        }
      } else {
        // Merge enything else
        if (AGate.Utils.isUndefined(entity[key])) {
          entity[key] = prototype[key]
        }
      }
    }
  }
}
