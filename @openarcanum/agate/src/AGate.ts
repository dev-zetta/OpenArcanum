export interface AGateConfig {
  dataPath?: string
  scriptsPath?: string
  appProtocol?: string
  client: { serverURL: string }
  server: { listenPort: number }
  [key: string]: unknown
}
import Utils from './shared/misc/Utils'
import Math from './shared/misc/Math'

import Database from './shared/realm/Database'
import EventEmitter from './shared/misc/EventEmitter'
import WorkerPool from './shared/misc/WorkerPool'

import GameEngine from './shared/GameEngine'

import AssetLoader from './shared/assets/AssetLoader'

global.lll = console.warn
global.lle = console.error

class AGateEngine {
  declare Const: Record<string, unknown>
  declare Utils: typeof Utils
  declare config: AGateConfig
  declare eventEmitter: EventEmitter
  declare workerPool: WorkerPool
  declare assetLoader: AssetLoader
  declare database: Database
  declare gameOptions: Record<string, unknown>
  declare _engine: GameEngine


  //Math: Math

  /**
   *
   * @param config
   */
  constructor(config: AGateConfig) {
    this.Utils = Utils
   // this.Math = Math

    this.Const = {
      Sprite: {
        DefaultExt: `gif`
      }
    }

    this.config = config

    this.eventEmitter = new EventEmitter()
    this.workerPool = new WorkerPool()
    this.assetLoader = new AssetLoader()
    this.database = new Database(this.assetLoader)

    this.gameOptions = {
      traceLevel: 1000,
      delayInputCount: 8,
      scheduler: `render-schedule`,
      //eventEmitter: this.eventEmitter,
      syncOptions: {
        sync: `frameSync`, // extrapolate
        localObjBending: 0.2,
        remoteObjBending: 0.5
      }
    }
  }

  /**
   *
   * @param namespace
   * @returns {*}
   */
  getConfig<Key extends keyof AGateConfig & string>(namespace: Key): AGateConfig[Key] {
    return this.config[namespace]
  }

  get engine(): GameEngine {
    if (!this._engine) {
      this.createEngine()
    }

    return this._engine
  }

  /**
   *
   * @param path
   * @returns {string}
   */
  getAppPath(path: string = ``): string {
    if (path.charAt(0) === `/`) {
      return path // dont append absolute path
    }

    return `${this.config.dataPath}/${path}`
  }

  /**
   *
   * @param path
   * @returns {string}
   */
  getAppUrl(path: string = ``): string {
    return `${this.config.appProtocol}${path}`
  }

  /**
   *
   * @param path
   * @returns {string}
   */
  getGfxUrl(path: string = ``): string {
    return this.getAppUrl(`Gfx/2D/${path}`)
  }

  /**
   *
   * @param subDir
   * @returns {string}
   */
  getDataPath(subDir: string = ``): string {
    return `${subDir}`
  }

  /**
   *
   * @param subDir
   * @returns {string}
   */
  getScriptsPath(subDir: string = ``): string {
    return `${this.config.scriptsPath}/${subDir}`
  }

  /**
   *
   */
  createEngine(): GameEngine {
    this._engine = new GameEngine(this, this.gameOptions)
    return this._engine
  }

}

export default AGateEngine
