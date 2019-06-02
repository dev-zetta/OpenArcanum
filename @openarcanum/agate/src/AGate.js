// @flow
import Utils from './shared/misc/Utils'
import Math from './shared/misc/Math'

import Database from './shared/realm/Database'
import EventEmitter from './shared/misc/EventEmitter'
import WorkerPool from './shared/misc/WorkerPool'
import ClientEngine from './client/ClientEngine'
import GameEngine from './shared/GameEngine'
import ServerEngine from './server/ServerEngine'
import AssetLoader from './shared/assets/AssetLoader'

global.lll = console.error

class AGateEngine {
  Const: Object
  Utils: Utils
  Math: Math

  config: Object
  eventEmitter: EventEmitter
  workerPool: WorkerPool
  assetLoader: AssetLoader
  database: Database
  client: ClientEngine
  server: ServerEngine
  gameOptions: Object
  _engine: GameEngine

  /**
   *
   * @param config
   */
  constructor(config: Object) {
    this.Utils = Utils
    this.Math = Math

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
      syncOptions: {
        sync: `extrapolate`,
        localObjBending: 0.2,
        remoteObjBending: 0.5
      }
    }
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
  createEngine() {
    this._engine = new GameEngine(this, this.gameOptions)
  }

  /**
   *
   * @param canvas
   * @returns {Promise<void>}
   */
  async createClient(canvas: HTMLCanvasElement): Promise<*> {
    await this.assetLoader.initialize()
    await this.database.initialize()

    if (this.config.server) {
      this.createServer()
      this.engine.server = this.server
    }

    this.client = new ClientEngine(this.engine, this.gameOptions, canvas)
    this.engine.client = this.client

    await this.client.create()
  }

  /**
   *
   */
  createServer() {
    this.server = new ServerEngine(this.engine, {
      debug: {},
      updateRate: 6,
      timeoutInterval: 0 // no timeout
    })

    this.server.start()
  }
}

export default AGateEngine
