/* global AGate */

import { ECS } from '../libs/ecs'
import { Entity } from './Entity'
import { Location } from './Location'

import { Flags } from './Flags'
import Base from './entity/components/Base'
import Critter from './entity/components/Critter'
import Npc from './entity/components/Npc'
import Visual from './entity/components/Visual'

let Components = {
  Base,
  Critter,
  Npc,
  Visual
}

import { NpcSystem } from './entity/systems/NpcSystem'
import { RenderSystem } from './entity/systems/RenderSystem'
import { CombatSystem } from './entity/systems/CombatSystem'

let Systems = {
  NpcSystem,
  CombatSystem,
  RenderSystem
}

const ClassTransformer = AGate.requireNode('class-transformer')

export class EntitySystem extends ECS {
  constructor(map) {
    super()

    this.map = map

    for (let key in Systems) {
      let system = Systems[key]
      console.log(`Adding entity system: ${key}`)
      this.addSystem(new system(map.engine, this))
    }

    this.prototypes = new Map()
    this.components = new Map()

    this.loadComponents()
  }

  /**
   *
   */
  loadComponents() {
    for (let key in Components) {
      this.components.set(key, Components[key])
    }

    /*AGate.Utils.loadScripts('shared/entity/components', (name, script) => {
      let component = script.component;

      this.components.set(name, component)
    })*/
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadPrototypes() {
    let assetLoader = this.map.engine.assetLoader

    let dataPath = AGate.getDataPath('Prototypes')

    let typeDirs = await assetLoader.findDirs(dataPath)
    for (let [type, entries] of typeDirs) {
      for (let [fileName, entry] of entries) {
        let meta = await assetLoader.loadJsonFile(
          `${dataPath}/${type}/${fileName}`
        )

        let key = AGate.Utils.getFileBase(fileName)

        this.prototypes.set(key, meta)
      }
    }
  }

  /**
   *
   */
  update() {
    super.update()
  }

  /**
   *
   * @param entity
   * @param prototype
   */
  addPrototypeData(entity, prototype) {
    //console.log(prototype)

    for (let key in prototype) {
      let value = prototype[key]

      if (AGate.Utils.isPlainObject(value)) {
        if (!entity[key]) entity[key] = {}

        this.addPrototypeData(entity[key], value)
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
              if (current.indexOf(val) != -1) {
                current.push(val)
              }
            }
          }
        }
      } else {
        // Merge enything else
        if (AGate.Utils.isUndefined(entity[key])) entity[key] = prototype[key]
      }
    }
  }

  /**
   *
   * @param id
   * @param data
   * @returns {Promise<Entity>}
   */
  async newEntity(id, data) {
    //let baseComponent = components.base;
    //baseComponent.id = id;
    //baseComponent.location = new Location(baseComponent.location[0], baseComponent.location[1]);

    // Apply prototype
    if (data['Base']) {
      let prototypeId = data['Base'].prototype

      if (prototypeId) {
        let prototype = this.prototypes.get(`${prototypeId}`)
        if (!prototype) {
          console.log(`Invalid prototype: ${prototype}`)
        } else {
          this.addPrototypeData(data, prototype)
        }
      }
    }

    // Load components' data and create instances
    let components = {}
    for (let key in data) {
      let component = this.components.get(key)

      if (!component) {
        AGate.Utils.logError(`Unknown component: ${key}`)
        continue
      }

      let instance = new component()
      Object.assign(instance, data[key]) // ClassTransformer.plainToClass(component, data[key]);
      instance.flags = new Flags(instance.flags)

      components[AGate.Utils.camelCase(key)] = instance
    }

    let entity = new Entity(this.map, id)
    await entity.loadFromData(components)

    // Add to system
    this.addEntity(entity)
    return entity
  }
}
