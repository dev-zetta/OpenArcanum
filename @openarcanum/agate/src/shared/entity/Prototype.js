//@flow

import Flags from '../Flags'
import Components from './components'

import Entity from './Entity'
import type GameEngine from '../GameEngine'
import Utils from '../misc/Utils'

//const ClassTransformer = require(`class-transformer`)

export default class Prototype extends Entity {
  /**
   *
   */
  constructor(engine: GameEngine, options: Object = {}) {
    super(engine, options)
  }

  /**
   * Create proxified components for entity/prototype
   * @param data - raw components
   * @param target - where to add generated components
   * @returns {*}
   */
  static createComponentsFromData(
    data: Object,
    prototype: Object,
    target: ?Entity | ?Function
  ): Object {
    let components = {}

    for (let key in data) {
      let componentClass = Components[key]

      if (!componentClass) {
        Utils.logError(`Unknown component: ${key}`)
        continue
      }

      let componentData = data[key]

      let component = new componentClass()
      if (componentData.flags) {
        component.flags = new Flags(componentData.flags)
      }

      let componentName = Prototype.componentInstanceToName(component)
      if (prototype) {
        Object.assign(component, componentData)
        component = Prototype.wrapObjectToProxy(
          componentName,
          component,
          prototype[componentName]
        )
      } else {
        // target = this prototype, save original data
        Prototype.processPrototypeComponent(
          componentName,
          component,
          componentData
        )

        /// lll('dsdds', component)
      }

      if (target) {
        if (typeof target === `function`) {
          target(componentName, component)
        } else {
          component.entity = target
          target.addComponent(component)
        }
      } else {
        components[componentName] = component
      }
    }

    return components
  }

  /**
   * Load components to this prototype
   * @param data
   * @returns {*}
   */
  loadComponents(data: Object) {
    Prototype.createComponentsFromData(data, null, this)
  }

  /**
   *
   * @param key
   * @param value
   * @param prototype
   * @returns {boolean}
   */
  static canBeProxified(key, value, prototype) {
    //console.log(prototype)
    return (
      Prototype.isValueObject(value) &&
      Prototype.isPrototypeProperty(key, prototype)
    )
  }

  /**
   *
   * @param value
   * @returns {boolean}
   */
  static isValueObject(value) {
    return typeof value === `object` && value != null
  }

  /**
   * Check if property is in prototype (raw/original data)
   * @param key
   * @param prototype
   * @returns {boolean}
   */
  static isPrototypeProperty(key, prototype) {
    return prototype != null && key in prototype._originalData
  }

  /**
   * Make component for prototype, i.e. copy properties deeply and save original data in the component
   * @param name
   * @param prototype
   * @param data
   */
  static processPrototypeComponent(name, prototype, data) {
    for (let key in data) {
      let value = data[key]
      if (Utils.isPlainObject(value)) {
        prototype[key] = {}
        Prototype.processPrototypeComponent(key, prototype[key], value)
      } else {
        prototype[key] = value
      }
    }

    prototype[`_originalData`] = data
  }

  /**
   * Generate component update and send it to the engine
   * @param obj
   * @param prop
   * @param value
   * @param parent
   * @returns {Promise<void>}
   */
  static async dispatchPropertyChange(
    obj: Object,
    prop: string,
    value: any,
    parent: Object
  ) {
    let update = null
    let path = []
    if (Array.isArray(obj)) {
      let prototype = obj[`_prototype`]
      let propName = prototype[`_propName`]

      path.push({
        prototype
      })

      let key = `${propName}[${prop}]`
      while (parent) {
        prototype = parent[`_prototype`]
        propName = prototype[`_propName`]

        key = `${propName}.${key}`

        path.push({
          prototype
        })

        if (!parent[`_parent`]) {
          break
        }

        parent = parent[`_parent`]
      }

      update = {
        key,
        value
      }
    } else {
      if (Prototype.isPrototypeProperty(prop, obj._prototype)) {
        let key = prop
        while (parent) {
          let prototype = parent[`_prototype`]

          path.push({
            prototype
          })

          key = `${prototype[`_propName`]}.${key}`
          if (!parent[`_parent`]) {
            break
          }

          parent = parent[`_parent`]
        }

        update = {
          key,
          value
        }
      }
    }

    if (update) {
      let entity = parent.entity

      if (!entity._update) {
        entity._update = {
          _totalUpdates: 0
        }
      }

      entity._update._totalUpdates++

      let currentPath = entity._update // root of entity, first is component name
      for (let i = path.length - 1; i >= 0; i--) {
        let { prototype } = path[i]

        let propName = prototype[`_propName`]

        if (!currentPath[propName]) {
          currentPath[propName] = {}
        }

        currentPath = currentPath[propName]
      }

      currentPath[prop] = value

      entity.engine.onEntityUpdate(entity)
    }
  }

  /**
   *
   * @param source
   * @param prototype
   * @param parent
   * @returns {*}
   */
  static wrapObjectToProxy(
    propertyName: string,
    source: Object,
    prototype: Object,
    parent: Object = source
  ): Proxy<Object> {
    for (let key in source) {
      let value = source[key]
      if (Prototype.canBeProxified(key, value, prototype)) {
        source[key] = Prototype.wrapObjectToProxy(
          key,
          value,
          prototype[key],
          source
        )
      }
    }

    if (!prototype[`_propName`]) {
      prototype[`_propName`] = propertyName // TODO: Hacked, fix
    }

    source[`_prototype`] = prototype

    if (source !== parent) {
      source[`_parent`] = parent
    }

    let handler = {
      get(obj, prop) {
        if (obj[prop] !== undefined) {
          return obj[prop]
        }

        if (obj._prototype) {
          return obj._prototype[prop]
        }

        return undefined
      },

      set(obj, prop, value) {
        if (
          Prototype.isValueObject(value) &&
          Prototype.isPrototypeProperty(prop, obj._prototype)
        ) {
          //lll('setting', prop, value)
          obj[prop] = Prototype.wrapObjectToProxy(
            prop,
            value,
            obj._prototype[prop],
            obj
          )
        } else {
          Prototype.dispatchPropertyChange(obj, prop, value, parent)
          //lll({prop, prototype: obj._prototype})

          obj[prop] = value
        }

        return true
      }
    }

    let result = new Proxy(source, handler)
    return result
  }

  /**
   *
   * @param engine
   * @param data
   * @returns {*}
   */
  createEntity(engine: GameEngine, data: Object): Object {
    let entity = new Entity(engine)

    Prototype.createComponentsFromData(data, this, entity)
    return entity
  }

  /**
   *
   * @param entity
   * @param source
   */
  copyToEntity(entity: Entity, source: ?Prototype = null) {
    let prototype = source || this

    for (let key in prototype) {
      let value = prototype[key]

      if (Utils.isPlainObject(value)) {
        if (!entity[key]) {
          entity[key] = {}
        }

        this.copyToEntity(entity[key], value)
      } else if (Utils.isArray(value)) {
        // Merge array
        if (!entity[key]) {
          entity[key] = prototype[key].slice(0)
        } else {
          // merge unique
          let current = entity[key]
          for (let val of value) {
            // Is not number and is already in array?
            if (!Utils.isNumber(val)) {
              if (current.indexOf(val) !== -1) {
                current.push(val)
              }
            }
          }
        }
      } else {
        // Merge enything else
        if (Utils.isUndefined(entity[key])) {
          entity[key] = prototype[key]
        }
      }
    }
  }
}
