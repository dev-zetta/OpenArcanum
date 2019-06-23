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
   * @param engine
   * @param options
   * @param canvas
   */
  constructor(engine: GameEngine, options: Object) {
    options = Object.assign(
      {
        autoConnect: false
      },
      options
    )

    super(engine, options)
    this.engine = engine
    this.engine.client = this


    this.guiManager = new Manager(engine)
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

  get assetLoader(): AssetLoader {
    return this.engine.assetLoader
  }

  get events(): EventEmitter {
    return this.engine.events
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
    lll('Client: Creating engine')


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
    lll('Client: Starting engine')

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

    /*this.controls.bindKey(`left`, `left`, {repeat: true})
    this.controls.bindKey(`right`, `right`, {repeat: true})
    this.controls.bindKey(`up`, `up`, {repeat: true})
    this.controls.bindKey(`space`, `space`)*/

    /*this.controls.on(`fire`, () => {
      this.sendInput(`space`)
    })*/

    //})

    //play sound when user fire missle
    this.events.on(`fireMissile`, () => {
      lll(`fireM`)

      if (this.renderer.scene) {
        //this.renderer.scene.soundFX_lasergun.play();
      }
    })
  }

  async join() {
    lll('Client: Joining server')
    const config = this.engine.getConfig(`client`)
    this.options.serverURL = config.serverURL
    await this.connect()
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

  async addPlayer(map, location) {
    let player = await map.addPlayer(location)
    this.player = player

    this.scene.onPlayerJoined(player, map)
    this.events.emit(`Player:Joined`, player, map)
  }

  /**
   *
   */
  async connect() {
    return super.connect()
  }

  /**
   * Disconnect from game server
   * @returns {*}
   */
  disconnect() {
    return super.disconnect()
  }

  /**
   * This function should be called by the client whenever a user input occurs.
   * This function will emit the input event, forward the input to the client's
   * game engine (with a delay if so configured) and will transmit the input to the server as well.
   *
   * This function can be called by the extended client engine class, typically at
   the beginning of client-side step processing {@see GameEngine#client__preStep}.
   * @param input
   * @param inputOptions
   */
  sendInput(input: string, inputOptions: Object) {
    console.log(`Sending input`, input, inputOptions)

    super.sendInput(input, {})
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
   * @returns {Promise<Object>}
   */
  async loadAsset(
    key: string,
    type: string,
    options: Object
  ): Promise<Object> {


    let descriptor = this.assetLoader.getCachedAsset(key)
    if (descriptor) {
      return descriptor
    }

    descriptor = Utils.merge(options, { key, type })

    let loaded = await this.assetLoader.loadAsset(descriptor)
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
