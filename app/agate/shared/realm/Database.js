import Model from './models/Model'
import * as Schemas from './models/Schemas'
import {Realm} from 'open-arcanum/agate/libs/RealmModel'

import interface_org from '../assets/interface_org'

export default class Database {
  /**
   *
   */
  constructor(engine) {
    this.engine = engine
    this.models = new Map()

    //this.fixArtIds()
  }


  async fixArtIds() {
    let fixed = {}
    for (let i in interface_org) {
      fixed[i] = AGate.Utils.upperCamelCase(interface_org[i])
    }

    //this.engine.assetLoader.saveJsonFile('test.json', fixed)

    let {assetLoader} = this.engine

    let fileList = await assetLoader.findFiles(`mes`, `json`)

    for (let filePath of fileList) {
      let modelName = AGate.Utils.getFileBase(filePath)
      if (!AGate.Utils.isFirstUpperCase(modelName)) {
        continue
      }

      let data = await assetLoader.loadJsonFile(filePath)

      let list = data[modelName]
      let yep = false
      for (let item of list) {
        if (item.art) {
          item.sprite = fixed[item.art]

          delete item.art
          yep = true
        }
      }

      if (yep) {
        assetLoader.saveJsonFile(filePath, data)
      }
    }

  }

  /**
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    let schemas = []
    for (let name in Schemas) {
      if (name === `default`) {
        continue
      }

      let properties = Schemas[name]
      let schema = {
        name,
        properties: Object.assign({}, properties)
      }
      if (properties.id) {
        schema.primaryKey = `id`
      }

      schemas.push(schema)
    }

    this.realm = await Realm.open({
      path: AGate.getAppPath('cache/db.realm'),
      schema: schemas
    })

    for (let schema of schemas) {
      let model = new Model(this.realm, schema)
      this.models.set(schema.name, model)
    }

    //await this.generateDatabase()
  }

  /**
   *
   * @param name
   * @returns {any}
   */
  getModel(name) {
    return this.models.get(name)
  }

  /**
   *
   * @param force
   * @returns {Promise<void>}
   */
  async generateDatabase(force = true) {
    let {assetLoader} = this.engine

    let fileList = await assetLoader.findFiles(`mes`, `json`)

    let models = {}

    for (let filePath of fileList) {
      let modelName = AGate.Utils.getFileBase(filePath)

      if (AGate.Utils.isFirstUpperCase(modelName)) {
        let model = this.getModel(modelName)
        if (model) {
          models[modelName] = {
            model,
            filePath,
            loaded: false
          }
        }
      }
    }

    for (let modelName in models) {
      await this.generateModels(modelName, models, force)
    }
  }

  /**
   *
   * @param modelName
   * @param models
   * @param force
   * @returns {Promise<void>}
   */
  async generateModels(modelName, models, force) {
    let current = models[modelName]
    let {model, loaded, filePath} = current

    if (loaded) {
      return
    }

    for (let property in model.linkedProperties) {
      let otherName = model.linkedProperties[property]
      let other = models[otherName]
      if (other && !other.loaded) {
        await this.generateModels(otherName, models, force)
      }
    }

    let {assetLoader} = this.engine

    lll(`Loading model ${modelName}`)
    let data = await assetLoader.loadJsonFile(filePath)

    let items = data[modelName]
    await model.create(items, force)

    current.loaded = true
  }
}
