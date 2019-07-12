// @flow

import ClientNetwork from './ClientNetwork'
import Scene from './Scene'
import Manager from './Gui'
import Renderer from './Renderer'
import Utils from './Utils'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'
import type AssetLoader from '../shared/assets/AssetLoader';
import type EventEmitter from '../shared/misc/EventEmitter';

export default class ClientEngine extends ClientNetwork {
  socket: Object // IO socket from lance
  renderer: Renderer

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
    this.gameEngine.client = this


    this.guiManager = new Manager(gameEngine)
    this.player = null

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.events.on(`Scene:Created`, this.onSceneCreated, this)

    // https://github.com/lance-gg/spaaace/blob/master/src/client/SpaaaceClientEngine.js
    this.networkMonitor.events.on(`RTTUpdate`, (e) => {
      //this.renderer.updateHUD(e);
    })

    //this.socket.emit('requestRestart');
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
   * @returns {EventEmitter}
   */
  get events(): EventEmitter {
    return this.gameEngine.events
  }



  /**
   *
   * @returns {{width: number, height: number}}
   */
  getWindowRect(): Object {
    return {
      width: window.innerWidth * window.devicePixelRatio,
      height: window.innerHeight * window.devicePixelRatio
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async create(canvas: HTMLCanvasElement) {
    lll('Client: Creating gameEngine')


    this.scene = new Scene(this, canvas)
    await this.scene.create(canvas)
    await this.guiManager.loadAssets()

    /*this.listenUI(`window.resize`, () => {
      let rect = this.getWindowRect()

      //this.physics.world.setBounds(x, y, width, height, true, true, true, true);
      //this.scene.resizeViewport(rect.width, rect.height)
    })*/

    /*this.listenUI(`game.reload`, () => {
      this.start()
    })*/
  }

  /**
   *
   */
  async start() {
    lll('Client: Starting gameEngine')

    await this.scene.start()

    await super.start()
    //await this.connect()

    lll(`Client - Starting`)

    this.events.emit(`Client:Started`, `default`)

    //this.gameEngine.once('renderer.ready', () => {
    //  Game input
    /*if (Utils.isTouchDevice()){
        this.controls = new MobileControls(this.renderer);
      } else {*/
    //this.controls = new Lance.KeyboardControls(this)
    //}

    //play sound when user fire missle
    this.events.on(`fireMissile`, () => {
      lll(`fireM`)

      if (this.renderer.scene) {
        //this.renderer.scene.soundFX_lasergun.play();
      }
    })
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async connect() {
    lll('Client: Joining server')
    const config = this.gameEngine.getConfig(`client`)
    this.options.serverURL = config.serverURL
    await super.connect()

    const player = this.player
    await this.joinServer({playerId: player.id})
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
    let location = map.getCenterLocation()

    this.addPlayer(map, location)

  }

  /**
   *
   * @param map
   * @param location
   * @returns {Promise<void>}
   */
  async addPlayer(map, location) {
    let player = await map.addPlayer(location)
    this.player = player

    await this.scene.onPlayerJoined(player, map)
    this.events.emit(`Player:Joined`, player, map)
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
   * @param path
   * @param command
   */
  sendCommand(path: string | Array, command: Object) {
    lll(`Sending command`, path, command)

    let result = this.gameEngine.evaluateCommand(path, command)
    let {source, action, data} = result

    this.sendRequest(action, data)

    this.events.emit(`${source}.Command`, {
      type: name,
      command
    })
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
   * @param args
   * @returns {EventEmitter}
   */
  listenUI(name: string, args: any) {
    return this.events.on(`ui.${name}`, args)
  }

  /**
   *
   * @param name
   * @param args
   * @returns {EventEmitter}
   */
  listenOnceUI(name: string, args: any) {
    return this.events.once(`ui.${name}`, args)
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
}
