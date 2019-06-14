// @flow

import Phaser from '../libs/Phaser'
import ClientNetwork from './ClientNetwork'
import Scene from './Scene'
import Manager from './Gui'
import Renderer from './Renderer'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'

export default class ClientEngine extends ClientNetwork {
  socket: Object // IO socket from lance

  /**
   *
   * @param engine
   * @param options
   * @param canvas
   */
  constructor(engine: GameEngine, options: Object, canvas: HTMLCanvasElement) {
    options = Object.assign(
      {
        autoConnect: false,
      },
      options
    )

    super(engine, options, Renderer)

    this.engine = engine
    this._canvas = canvas
    //this.assetServer = new AssetServer();
    //this.assetServer.start(AGate.getDataPath());
    this.guiManager = new Manager(engine)

    this.player = null

    //this.engine.events = this.engine.events
    this.engine.events.on(`Map:Loading`, this.onMapLoading, this)
    this.engine.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.engine.events.on(`Scene:Created`, this.onSceneCreated, this)

    // https://github.com/lance-gg/spaaace/blob/master/src/client/SpaaaceClientEngine.js
    this.networkMonitor.on(`RTTUpdate`, (e) => {
      //this.renderer.updateHUD(e);
    })

    //this.socket.emit('requestRestart');
    //this.socket.emit
  }




  /**
   *
   * @returns {HTMLCanvasElement}
   */
  get canvas(): HTMLCanvasElement {
    return this._canvas
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
  async create() {
    await this.guiManager.loadAssets()

    this.listenUI(`game.reload`, () => {
      this.start()
    })

    let contextCreationConfig = {
      alpha: false,
      depth: true,
      antialias: true,
      premultipliedAlpha: true,
      stencil: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: `default`
    }

    let myCustomContext = this._canvas.getContext(
      `webgl2`,
      contextCreationConfig
    )

    this.game = new Phaser.Game({
      ...this.getWindowRect(),
      canvas: this._canvas,
      context: myCustomContext,
      type: Phaser.WEBGL,
      transparent: true,
      //antialias: true,
      multiTexture: false,
      enableDebug: false,
      input: {
        queue: false,
        windowEvents: false
      },
      scale: {
        mode: Phaser.Scale.ENVELOP,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      autoRound: false
    })

    this.scene = new Scene(this)
    this.game.scene.add(`default`, this.scene)

    this.listenUI(`window.resize`, () => {
      let rect = this.getWindowRect()

      //this.physics.world.setBounds(x, y, width, height, true, true, true, true);
      //this.scene.resizeViewport(rect.width, rect.height)
    })
  }





  /**
   *
   */
  async start() {
    super.start()
    //await this.connect()

    lll(`Client - Starting`)

    this.engine.events.emit(`Client:Started`, `default`)
    this.game.scene.start(`default`)

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
    this.gameEngine.events.on(`fireMissile`, () => {
      lll(`fireM`)

      if (this.renderer.scene) {
        //this.renderer.scene.soundFX_lasergun.play();
      }
    })
  }

  async join() {
    const config = this.engine.getConfig('client')
    this.options.serverURL = config.serverURL
    await this.connect()
  }

  /**
   *
   * @param scene
   */
  onSceneCreated(scene: Scene) {
    this.engine.events.emit(`Client:Created`, this)
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
    map.addPlayer(location).then(player => {
      this.player = player
      this.engine.events.emit(`Player:Joined`, player)
      this.scene.addEntity(this.player, map.rootGroup)
    })
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
    console.log('Sending input', input, inputOptions)

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
    return this.engine.events.on(`ui.${name}`, args)
  }

  /**
   *
   * @param name
   * @param args
   * @returns {EventEmitter}
   */
  listenOnceUI(name: string, args: any) {
    return this.engine.events.once(`ui.${name}`, args)
  }

  /**
   *
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitUI(name: string, ...args: any) {
    return this.engine.events.emit(`ui.${name}`, ...args)
  }

}
