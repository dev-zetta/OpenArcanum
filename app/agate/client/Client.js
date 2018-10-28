/* global AGate, window */

import Phaser from '../libs/phaser'
//import {AssetServer} from '../server/AssetServer';
import Lance from '../libs/lance'
import { Scene } from './Scene'
import { Manager } from './Gui'
import { Renderer } from './Renderer'

export class Client extends Lance.ClientEngine {
  /**
   *
   * @param engine
   * @param canvas
   */
  constructor(engine, options, canvas) {
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
   * @returns {Promise<void>}
   */
  async create() {
    await this.guiManager.loadAssets()

    var contextCreationConfig = {
      alpha: false,
      depth: false,
      antialias: true,
      premultipliedAlpha: true,
      stencil: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'default'
    }

    var myCustomContext = this._canvas.getContext(
      'webgl2',
      contextCreationConfig
    )

    let self = this
    this.game = new Phaser.Game({
      width: window.innerWidth * window.devicePixelRatio,
      height: window.innerHeight * window.devicePixelRatio,
      canvas: this._canvas,
      context: myCustomContext,
      renderType: Phaser.WEBGL,
      transparent: true,
      //antialias: true,
      multiTexture: false,
      enableDebug: false
    })

    this.scene = new Scene(this)
    this.game.scene.add('default', this.scene)
    this.game.scene.start('default')
  }

  /**
   *
   * @returns {*}
   */
  get canvas() {
    return this._canvas
  }

  /**
   *
   * @param map
   */
  onMapLoading(map) {
    this.scene.onMapLoading(map)
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map) {
    this.scene.onMapLoaded(map)
    map.placeToScene(this.scene)

    let location = map.getCenterLocation()
    map.addPlayer(location).then(player => {
      this.player = player

      this.player.placeToScene(map.rootGroup)
    })
  }

  update() {}
}
