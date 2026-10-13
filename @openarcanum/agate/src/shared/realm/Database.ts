import Utils from '../misc/Utils'
import type { RealmSchema, RealmStore, RealmRecord } from '../../libs/Realm'
interface ModelSource {model: Model; filePath: string; loaded: boolean}
function jsonRecord(value: unknown): RealmRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid legacy model JSON')
  return value as RealmRecord
}
import type AssetLoader from '../assets/AssetLoader';

import Model from './models/Model'
import * as Schemas from './models/Schemas'
import Realm from '../../libs/Realm'

import interface_org from '../assets/interface_org'

export default class Database {
  declare assetLoader: AssetLoader
  declare models: Map<string, Model>
  declare realm: RealmStore


  /**
   *
   */
  constructor(assetLoader: AssetLoader) {
    this.assetLoader = assetLoader
    this.models = new Map()

    //this.fixArtIds()
  }

  async fixArtIds() {
    let fixed: Record<string, string> = {}
    for (let i in interface_org) {
      fixed[i] = Utils.upperCamelCase(Reflect.get(interface_org, i) as string)
    }

    //this.engine.assetLoader.saveJsonFile('test.json', fixed)

    let assetLoader = this.assetLoader

    let fileList = await assetLoader.findFiles(`mes`, `json`)

    for (const file of fileList) {
      const filePath = typeof file === 'string' ? file : file[0]
      let modelName = Utils.getFileBase(filePath)
      if (!Utils.isFirstUpperCase(modelName)) {
        continue
      }

      let data = jsonRecord(await assetLoader.loadJsonFile(filePath))

      let list = data[modelName] as RealmRecord[]
      let yep = false
      for (let item of list) {
        if (item.art) {
          item.sprite = fixed[item.art as string]

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
    let schemas: RealmSchema[] = []
    for (let name in Schemas) {
      if (name === `default`) {
        continue
      }

      let properties = Reflect.get(Schemas, name) as Record<string, string>
      let schema: RealmSchema = {
        name,
        properties: Object.assign({}, properties),
      }
      if (properties.id) {
        schema.primaryKey = `id`
      }

      schemas.push(schema)
    }

    this.realm = await Realm.open({
      path: AGate.getAppPath(`cache/db.realm`),
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
  getModel(name: string): Model | undefined {
    return this.models.get(name)
  }

  /**
   *
   * @param force
   * @returns {Promise<void>}
   */
  async generateDatabase(force: boolean = true) {
    let assetLoader = this.assetLoader

    let fileList = await assetLoader.findFiles(`mes`, `json`)

    let models: Record<string, ModelSource> = {}

    for (const file of fileList) {
      const filePath = typeof file === 'string' ? file : file[0]
      let modelName = Utils.getFileBase(filePath)

      if (Utils.isFirstUpperCase(modelName)) {
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
  async generateModels(modelName: string, models: Record<string, ModelSource>, force: boolean) {
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

    let assetLoader = this.assetLoader

    lll(`Loading model ${modelName}`)
    let data = jsonRecord(await assetLoader.loadJsonFile(filePath))

    let items = data[modelName] as RealmRecord[]
    await model.create(items, force)

    current.loaded = true
  }
}
