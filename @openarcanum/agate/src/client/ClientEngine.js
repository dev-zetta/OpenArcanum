// @flow

import Phaser from '../libs/Phaser'
import Lance from '../libs/Lance'
import Scene from './Scene'
import Manager from './Gui'
import Renderer from './Renderer'
import type GameEngine from '../shared/GameEngine';
import type GameMap from '../shared/map/GameMap';

export default class ClientEngine extends Lance.ClientEngine {
  /**
   *
   * @param engine
   * @param options
   * @param canvas
   */
  constructor(engine: GameEngine, options: Object, canvas: HTMLCanvasElement) {
    const config = AGate.config.client

    options = Object.assign(
      {
        autoConnect: false,
        serverURL: config.serverURL
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

    this.engine.events.listenUI(`game.reload`, () => {
      this.start()
    })

    let contextCreationConfig = {
      alpha: false,
      depth: true,
      antialias: true,
      premultipliedAlpha: true,
      //stencil: true,
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
      enableDebug: false
    })

    this.scene = new Scene(this)
    this.game.scene.add(`default`, this.scene)

    this.engine.events.listenUI(`window.resize`, (e) => {
      this.game.resize(e.width, e.height)
    })

    this.start()
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
   * @param map
   */
  onMapLoading(map: GameMap) {
    this.scene.onMapLoading(map)
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {
    this.scene.onMapLoaded(map)

    let location = map.getCenterLocation()
    map.addPlayer(location).then(player => {
      this.player = player

      this.scene.addEntity(this.player, map.rootGroup)
    })
  }

  /**
   *
   */
  async connect() {
    let result = await super.connect()
  }

  /**
   *
   */
  start() {
    super.start()
    this.connect().then(() => {
      this.game.scene.start(`default`)
    })

    //this.gameEngine.once('renderer.ready', () => {
    //  Game input
    /*if (Utils.isTouchDevice()){
        this.controls = new MobileControls(this.renderer);
      } else {*/
    this.controls = new Lance.KeyboardControls(this)
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
    this.gameEngine.on(`fireMissile`, () => {
      lll(`fireM`)

      if (this.renderer.scene) {
        //this.renderer.scene.soundFX_lasergun.play();
      }
    })
  }

  /**
   *
   * @param syncData
   */
  handleInboundMessage(syncData: Object) {
    let buffer = Uint8Array.from(syncData.dataBuffer)
    syncData.dataBuffer = buffer.buffer
    super.handleInboundMessage(syncData)
  }

}
