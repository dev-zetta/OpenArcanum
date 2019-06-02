// @flow

import ECS from '../../libs/ECS'
import Entity from './Entity'
import Prototype from './Prototype'

import Flags from '../Flags'

import Systems from './systems'
import type GameMap from '../map/GameMap';
import Components from './components'

//const ClassTransformer = require('class-transformer')

export default class EntitySystem extends ECS {
  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    super()

    this.map = map
    this.engine = map.engine

    for (let key in Systems) {
      let system = Systems[key]
      console.log(`Adding entity system: ${key}`)
      this.addSystem(new system(this.engine, this))
    }

    this.prototypes = new Map()
    this.components = new Map()

    //this.loadComponents()
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
  async loadPrototypes(reload:boolean = false) : Promise<*> {
    if (this.prototypes.size > 0 && !reload) {
      return
    }

    let assetLoader = this.engine.assetLoader
    let dataPath = AGate.getDataPath(`Prototypes`)

    let typeDirs = await assetLoader.findDirs(dataPath)
    for (let [type, entries] of typeDirs) {
      for (let [fileName, entry] of entries) {
        let meta = await assetLoader.loadJsonFile(
          `${dataPath}/${type}/${fileName}`
        )

        let key = AGate.Utils.getFileBase(fileName)

        let prototype = Prototype.fromData(meta)
        prototype.engine = this.engine

        this.prototypes.set(key, prototype)
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
   * @param id
   * @param data
   * @returns {Promise<Entity>}
   */
  async newEntity(id: string, data: Object): Promise<Entity> {
    //let baseComponent = components.base;
    //baseComponent.id = id;
    //baseComponent.location = new Location(baseComponent.location[0], baseComponent.location[1]);

    // Apply prototype
    let entity = null
    if (data[`Base`]) {
      let prototypeId = data[`Base`].prototype

      if (prototypeId) {
        let prototype = this.prototypes.get(`${prototypeId}`)
        if (!prototype) {
          console.log(`Invalid prototype: ${prototype}`)
        } else {
          entity = prototype.createEntity(this.engine, data)
        }
      }
    }

    // Load components' data and create instances
    if (!entity) {
      entity = new Entity(this.engine)
    }

    await entity.loadData()

    // Add to system
    entity.id = id
    this.addEntity(entity)
    return entity
  }
}
