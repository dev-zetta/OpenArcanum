/* global AGate */
import Lance from '../libs/lance'
import { Client } from '../client/Client'
import { GameMap } from './map/GameMap'
import { AssetLoader } from './assets'
import { WorkerPool } from './misc/WorkerPool'
import { EventEmitter } from './misc/EventEmitter'
import { ServerEngine } from '../server/ServerEngine'

const socketIo = requireNode('socket.io')

export class Engine extends Lance.GameEngine {
  constructor() {
    const options = {
      traceLevel: 1000,
      delayInputCount: 8,
      scheduler: 'render-schedule',
      syncOptions: {
        sync: 'extrapolate',
        localObjBending: 0.2,
        remoteObjBending: 0.5
      }
    }

    super(options)

    this.options = options

    this.events = new EventEmitter()
    this.workerPool = new WorkerPool(this)
    this.assetLoader = new AssetLoader(this)
    this.map = new GameMap(this)

    this.createServer()
  }

  /**
   *
   * @param canvas
   * @returns {Promise<void>}
   */
  async createClient(canvas) {
    await this.assetLoader.initialize()

    this.client = new Client(this, this.options, canvas)

    await this.client.create()
  }

  /**
   *
   */
  update() {
    this.map.update()

    if (this.client) {
      this.client.update()
    }
  }

  /**
   *
   */
  load() {
    let path = AGate.getDataPath('Bates Mansion Lev 2')
    this.map.load(path)
  }

  /**
   *
   */
  onPreloaded() {
    this.load()
  }

  /**
   *
   * @param map
   */
  onMapLoading(map) {
    this.client.onMapLoading(map)
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map) {
    this.client.onMapLoaded(map)
  }

  createServer() {
    var io = socketIo()
    io.on('connection', client => {})

    io.listen(3000)

    this.server = new ServerEngine(io, this, {
      debug: {},
      updateRate: 6,
      timeoutInterval: 0 // no timeout
    })

    this.server.start()
  }
}
