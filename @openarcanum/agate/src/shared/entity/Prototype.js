//@flow

import Components from './components'

import Entity from './Entity'
import type GameEngine from '../GameEngine'
import Utils from '../misc/Utils'
import Component from './components/Component'

//const ClassTransformer = require(`class-transformer`)

export default class Prototype extends Entity {
  /**
   *
   */
  constructor(engine: GameEngine, options: Object = {}) {
    super(engine, options)
  }

  /**
   *
   * @param componentName
   * @param componentData
   * @param component
   * @param prototype
   * @returns {*}
   */
  onAddComponent(componentName, componentData, component, prototype) {
    // target = this prototype, save original data
    Prototype.setPropertiesFromData(componentName, componentData, component)

    /*if (componentName == 'visual') {
      if (componentData['render']['flags'].length > 0)
      lll('dfsfsd', componentData, component)
    }*/

    return component
  }

  /**
   * Create proxified components for entity/prototype
   * @param data - raw components
   * @param prototype - Prototype
   * @param target - where to add generated components
   * @returns {*}
   */
  static addComponentsToEntity(
    entity: Entity,
    data: Object,
    prototype: Prototype
  ): Object {
    let components = {}

    for (let key in data) {
      let componentClass = Components[key]

      if (!componentClass) {
        Utils.logError(`Unknown component: ${key}`)
        continue
      }

      let component = entity.addComponent(componentClass, data[key], prototype)
      components[key] = component
    }

    // Check if we have a entity with missing components... if yes, add empty components that are referring to prototype's components
    if (entity.components.length !== prototype.components.length) {
      for (let componentClass of prototype.components) {
        if (entity.components.includes(componentClass)) {
          continue
        }

        let key = componentClass.name
        let component = entity.addComponent(componentClass, {}, prototype)
        components[key] = component

        if (key == 'Visual')
        lll('dsfdf', component.classes.current, key, prototype)
      }


    }

    return components
  }

  /**
   * Create proxified components for entity/prototype
   * @param data - raw components
   * @param target - where to add generated components
   * @returns {*}
   */
  static createPrototypeComponentsFromData(
    prototype: Prototype,
    data: Object
  ): Object {
    let components = {}

    for (let key in data) {
      let componentClass = Components[key]

      if (!componentClass) {
        Utils.logError(`Unknown component: ${key}`)
        continue
      }

      if (key === 'Npc') {  // TODO: Hack
        if (!data[key]['waypoints']) {
          data[key]['waypoints'] = []
          //lll('missing waypoints', data)
        }
      }

      if (key === 'Visual') {  // TODO: Hack
        if (!data[key]['render'])
          data[key]['render'] = {}


        if (!data[key]['render']['flags']) {
          data[key]['render']['flags'] = []
        }
      }

      //lll(componentClass)
      let component = prototype.addComponent(componentClass, data[key], null) // Prototype components are not proxyfied

      components[key] = component
    }

    //lll(components)
    return components
  }

  /**
   * Load components to this prototype
   * @param data
   * @returns {*}
   */
  loadComponents(data: Object) {
    Prototype.createPrototypeComponentsFromData(this, data)
  }

  /**
   *
   * @param name
   * @param prototype
   * @param data
   */
  /*static processPrototypeComponent(name, data, prototype) {
    for (let key in data) {
      let value = data[key]
      if (Utils.isPlainObject(value)) {
        prototype[key] = {}
        Prototype.processPrototypeComponent(key, value, prototype[key])
      } else {
        prototype[key] = value
      }
    }

    prototype[`_originalData`] = data
    prototype[`_propName`] = name
  }*/

  /**
   * Generate component update and send it to the engine
   * @param obj
   * @param prop
   * @param value
   * @param parent
   * @returns {Promise<void>}
   */
  static async dispatchPropertyChange(obj: Object, prop: string, value: any) {
    let parent = obj[`_parent`]

    let update = null
    let path = []
    if (Array.isArray(obj)) {
      lll('array')
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
      } else {
        //lll('not')
      }
    }


    //lll(obj, prop, path, update)

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

      entity.triggerUpdate()
    }
  }

  /**
   *
   * @param object
   * @returns {*}
   */
  static isSetableObject(object) {
    return Utils.isObjectLike(object) && Utils.isFunction(object.set)
  }

  /**
   *
   * @param name
   * @param value
   * @param target
   */
  static setPropertyFromData(
    name: string,
    value: Object,
    target: Entity | Prototype
  ) {
    if (Prototype.isSetableObject(target[name])) {
      target[name].set(value) // Its a class. Call set method
    } else {
      target[name] = value
    }
  }

  /**
   * Copy properties deeply and save original data in the component, if it's prototype component
   * @param name
   * @param data
   * @param target
   * @param prototype
   */
  static setPropertiesFromData(name, data, target: Entity | Prototype) {
    //lll(name, data, target)
    if (Utils.isPlainObject(data)) {
      for (let key in data) {
        let value = data[key]

        //if (key == 'flags')
        //  lll('asdasda', target[key], value)

        if (Prototype.isSetableObject(target[key])) {
          target[key].set(value) // Its a class. Call set method
        } else {
          if (Utils.isObjectLike(value)) {
            if (!target[key]) {
              target[key] = {} // create object in target only if it doesnt exists
            }

            Prototype.setPropertiesFromData(key, value, target[key])
          } else {
            target[key] = value
          }
        }
      }
    }

    target[`_originalData`] = data
    target[`_propName`] = name
  }

  /**
   *
   * @param componentName
   * @param componentData
   * @param component
   * @returns {Proxy<Object>}
   */
  wrapComponent(componentName, componentData, component) {
    return Prototype.wrapComponentToProxy(
      componentName,
      componentData,
      component,
      this[componentName]
    )
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
    //if (Utils.isUndefined(prototype[`_originalData`])) {
    //  lll(key, prototype)
    //}

    return prototype != null && prototype[`_originalData`] &&  key in prototype[`_originalData`]
  }

  /**
   * Wrap component to proxy. Load the data at same time. Assign prototype to each subobject
   * @param propertyName
   * @param data
   * @param object
   * @param prototype
   * @param parent
   * @returns {*}
   */
  static wrapComponentToProxy(
    propertyName: string,
    data: Object,
    object: Component | Object,
    prototype: Object,
    parent: Object = object
  ): Proxy<Object> {



    if (Prototype.isSetableObject(prototype)) {
      object.set(data)
    } else {
      const prototypeData = prototype[`_originalData`] // original data of prototype... compare new component data with prototype component data

      for (let key in prototypeData) {


        let value = data[key]
        if (Utils.isUndefined(value)) {
          // the property is not present in loaded in data...
          if (Prototype.isSetableObject(object[key])) {
            delete object[key] //object[key].clear() // clean settable and continue
            continue
          } else {
            if (Utils.isPlainObject(prototypeData[key])) {
              value = {} // objects will be wrapped
            } else {
              delete object[key] // remove from object... it's reused component, we don't want to have previous
              continue
            }



          }


        }





        if (Prototype.canBeProxified(key, value, prototype)) {
          // replace object with wrapped object
          if (Utils.isUndefined(object[key])) {
            let prototypeProperty = prototype[key]
            //lll(prototypeProperty)

            object[key] = new prototypeProperty.constructor()
          }

          object[key] = Prototype.wrapComponentToProxy(
            key,
            value,
            object[key],
            prototype[key],
            object
          )
        } else {
          //lll(key, value, object)
          Prototype.setPropertyFromData(key, value, object)
        }
      }
    }



    /*if (!prototype[`_propName`]) {
      prototype[`_propName`] = propertyName // TODO: Hacked, fix
    }*/

    if (object == 'Item') {
      lll('dsfsdfs', propertyName, data, prototype)
    }

    object[`_prototype`] = prototype

    if (object !== parent) {
      object[`_parent`] = parent
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
          obj[prop] = Prototype.wrapComponentToProxy(
            prop,
            value,
            obj._prototype[prop],
            obj
          )
        } else {
          Prototype.dispatchPropertyChange(obj, prop, value)
          //lll({prop, prototype: obj._prototype})

          obj[prop] = value
        }

        return true
      }
    }

    let result = new Proxy(object, handler)
    return result
  }

  /**
   *
   * @param entity
   * @param data
   * @returns {*}
   */
  extendEntity(entity: Entity, data: Object): Entity {
    //let entity = new Entity(this.engine)

    Prototype.addComponentsToEntity(entity, data, this)
    return entity
  }

  /**
   *
   * @param entity
   * @param source
   */
  /*copyToEntity(entity: Entity, source: ?Prototype = null) {
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
  }*/
}
