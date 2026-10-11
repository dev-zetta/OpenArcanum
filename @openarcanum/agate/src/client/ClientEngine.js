// @flow

import ClientNetwork from './network/ClientNetwork'
import Scene from './Scene'
import Manager from './Gui'
import Renderer from './Renderer'
import Utils from './Utils'
import EntityUtils from '../shared/entity/Utils'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'
import type AssetLoader from '../shared/assets/AssetLoader';
import type EventEmitter from '../shared/misc/EventEmitter';
import GfxPathBuilder from '../shared/assets/GfxPathBuilder';
import Player from '../shared/player/Player'
import StepState from '../shared/StepState';
import * as PlayerLogic from './logic/player'

export default class ClientEngine extends ClientNetwork {
  renderer: Renderer
  scene: Scene
  guiManager: Manager
  player: Player
  commandEvaluators: Map<string, Object>

  /**
   *
   * @param gameEngine
   * @param options
   * @param canvas
   */
  constructor(gameEngine: GameEngine, options: Object) {
    options = Object.assign(
      {
        autoConnect: false
      },
      options
    )

    super(gameEngine, options)
    this.guiManager = new Manager(gameEngine)
    this.player = null

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.events.on(`Scene:Created`, this.onSceneCreated, this)
    this.events.on(`Object:Click`, this.onObjectClick, this)
    this.events.on(`Object:Updated`, this.onObjectUpdated, this)
    this.events.on('Game:Start', this.onStartGame, this)

    this.commandEvaluators = new Map()

    //this.events.on(`player.command`, this.onPlayerCommand, this)

    this.addCommandEvaluators(`Player`, PlayerLogic)

  }

  /**
   *
   * @returns {AssetLoader}
   */
  get assetLoader(): AssetLoader {
    return this.gameEngine.assetLoader
  }


  /**
   *
   * @returns {{width: number, height: number}}
   */
  getWindowRect(): Object {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async create(canvas: HTMLCanvasElement) {
    lll('Client: Creating gameEngine')


    this.scene = new Scene(this)
    await this.scene.create(canvas)
    await this.guiManager.loadAssets()

    /*this.listenUI(`window.resize`, () => {
      let rect = this.getWindowRect()

      //this.physics.world.setBounds(x, y, width, height, true, true, true, true);
      //this.scene.resizeViewport(rect.width, rect.height)
    })*/

    this.listenUI('startGameBtn:click', () => {
      this.events.emit('Game:Start')
    })

    //this.events.on(`objectAdded`, this.onObjectAdded.bind(this))
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async onStartGame() {
    await this.start()
    await this.connect()
  }

  /**
   *
   */
  updateEntities() {
    let entities = this.world.getDynamicEntities()

    for (let [id, entity] of entities) {
      this.updateEntity(entity)
    }
  }

  /**
   *
   * @param entity
   */
  updateEntity(entity: Entity) {
    this.guiManager.updateEntityBubble(entity)
  }

  /**
   *
   * @param state
   */
  step(state: StepState) {
    if (!this.world) {
      return
    }

    super.step(state)
    this.updateEntities()
  }

  /**
   *
   */
  async start() {
    lll('Client: Starting')

    await this.scene.start()

    await super.start()
    //await this.connect()

    this.events.emit(`Client:Started`, `default`)

    //this.gameEngine.once('renderer.ready', () => {
    //  Game input
    /*if (Utils.isTouchDevice()){
        this.controls = new MobileControls(this.renderer);
      } else {*/
    //this.controls = new Lance.KeyboardControls(this)
    //}

    //play sound when user fire missle
    // this.events.on(`fireMissile`, () => {
    //   lll(`fireM`)
    //
    //   if (this.renderer.scene) {
    //     //this.renderer.scene.soundFX_lasergun.play();
    //   }
    //})
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async connect(options: Object = {}) {
    lll('Client: Joining server')
    const config = this.gameEngine.getConfig(`client`)
    this.options.serverURL = config.serverURL
    await super.connect(options)

    await this.joinServer({ login: { user: 'test', password: 'test' } })
  }


  /**
   * Disconnect from game server
   * @returns {*}
   */
  disconnect() {
    return super.disconnect()
  }


  /**
   *
   * @param scene
   */
  onSceneCreated(scene: Scene) {
    this.events.emit(`Client:Created`, this)
    this.scene.start()
  }

  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {}

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {


  }

  /**
   *
   * @param entity
   */
  onObjectAdded(entity) {
    this.guiManager.addEntityBubble(entity)
  }

  /**
   *
   * @param entity
   */
  onObjectUpdated(entity) {

  }

  /**
   *
   * @param gameObject
   */
  onObjectClick(gameObject: Object) {
    lll(gameObject)
    if (gameObject.data) {
      let data = gameObject.data

      const isObject = Utils.isUndefined(data.type)
      if (isObject) {
        this.sendCommand(`Player:EntitySelect`, { entity: data })
      } else {
        this.sendCommand(`Player:TileSelect`, { tile: data })
      }

      if (data.type !== `Tile`) {
        this.guiManager.addDatGui(data)
      }
    } else {
      this.guiManager.addDatGui(gameObject)
    }
  }

  /**
   *
   * @param map
   * @param location
   * @returns {Promise<void>}
   */
  async addPlayer(location: Location) {
    let player = await this.world.addPlayer(location)
    this.player = player

    this.events.emit(`Player:Joined`, player)
  }

  /**
   *
   * @param path
   * @param command
   */
  sendCommand(path: string | Array, command: Object) {
    lll(`Client: Sending command`, path, command)

    let result = this.evaluateCommand(path, command)
    let {source, action, data} = result

    if (action) {
      this.sendRequest(action, data)
    }


    this.events.emit(`${source}.Command`, {
      type: name,
      command
    })
  }

  /**
   *
   * @param name
   * @param logics
   */
  addCommandEvaluators(name: string, logics: Object) {
    let instances = new Map()
    for (let name in logics) {
      let classType = logics[name]
      instances.set(name, new classType({ engine: this }))
    }

    this.commandEvaluators.set(name, instances)
  }

  /**
   *
   * @param path
   * @param command
   * @returns {{source: string, name: string, action: *, data: *}}
   */
  evaluateCommand(path: Array|string, command: Object) {
    if (Utils.isString(path)) {
      path = path.split(`:`)
    }

    let source = path[0]
    let name = path[1]

    let evaluators = this.commandEvaluators.get(source)

    let evaluator = evaluators.get(name)

    let result = evaluator.onCommand(command)

    lle(`command`, { command, result })
    return {source, name, action: result.action, data: result.data}
  }


  /**
   *  handle a message that has been received from the server
   * @param syncData
   */
  handleInboundMessage(syncData: Object) {
    let buffer = Uint8Array.from(syncData.dataBuffer)
    syncData.dataBuffer = buffer.buffer
    super.handleInboundMessage(syncData)
  }

  // emit an input to the authoritative server
  handleOutboundInput() {
    super.handleOutboundInput()
  }

  /**
   *
   * @param name
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenUI(name: string, listener: any, context) {
    return this.events.on(`ui.${name}`, listener, context)
  }

  /**
   *
   * @param name
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenOnceUI(name: string, listener: any, context) {
    return this.events.once(`ui.${name}`, listener, context)
  }

  /**
   *
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitUI(name: string, ...args: any) {
    return this.events.emit(`ui.${name}`, ...args)
  }

  /**
   *
   * @param key
   * @param type
   * @param options
   * @param target
   * @returns {Promise<Object>}
   */
  async loadAsset(
    key: string,
    type: string,
    options: Object,
    target: ?Object
  ): Promise<Object> {


    let descriptor = this.assetLoader.getCachedAsset(key)
    if (descriptor) {
      return descriptor
    }

    descriptor = Utils.merge(options, { key, type })

    let loaded = await this.assetLoader.loadAsset(descriptor, target)
    if (!loaded) {
      return null
    }

    switch (descriptor.type) {
      case `atlas`: {
        break
      }
      case `shader`: {

        break
      }
    }

    return descriptor
  }

  /**
   *
   * @param art
   */
  getGfxPath(art) {
    return GfxPathBuilder.build(art)
  }

}
