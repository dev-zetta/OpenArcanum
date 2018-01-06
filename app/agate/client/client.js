/* global requireNode */

import AGate from '../agate'
import Phaser from './phaser'

/*
import Boot from './states/boot'
import Game from './states/game'
import Menu from './states/menu'
import Preloader from './states/preloader'
import Gameover from './states/gameover'
*/

import AssetServer from '../server/asset-server'

import {Location, Sector} from '../shared/game-map'

class Scene extends Phaser.Scene {
  constructor(client) {
    super({ key: 'default' })
    this.client = client
    this.loadedAssets = {}
    this.renderToTexture = true
  }

  loadAsset(key, type, options) {
      if (this.loadedAssets.hasOwnProperty(key)) {
          return true
      }

      let data = AGate.Utils.merge(options, { 'key': key })

     // AGate.Utils.logError(data)

      this.load[type].call(this.load, /*data*/ key, options.texture, options. data)
      this.loadedAssets[key] = type
  }

  update(time, delta) {
      //this.engine.update()

      /*if (!AGate.Utils.isUndefined(this.player)) {
          //this.player.body.setZeroVelocity()

          if (this.cursorKeys.up.isDown)
          {
              this.player.body.moveUp(300)
          }
          else if (this.cursorKeys.down.isDown)
          {
              this.player.body.moveDown(300);
          }

          if (this.cursorKeys.left.isDown)
          {
              this.player.body.velocity.x = -300;
          }
          else if (this.cursorKeys.right.isDown)
          {
              this.player.body.moveRight(300);
          }
      }*/

      if (!AGate.Utils.isUndefined(this.cameraControls)) {
          this.cameraControls.update(delta)
      }

      if (!AGate.Utils.isUndefined(this.text)) {
          let cam = this.cameras.main
          this.text.setText([
              `Cam: ${cam.scrollX}:${cam.scrollY}`
              //`FPS: ${this.time.fps}`
          ])
      }

      //this.game.debug.text(, 2, 14, "#00ff00")
  }

  render() {
      this.debug.cameraInfo(this.game.camera, 32, 32);
      //this.game.debug.spriteCoords(this.player, 32, 500);
  }

  preload() {
      AGate.Utils.logError("Preloading client...")
      this.cursorKeys = this.game.input.keyboard.createCursorKeys()

      var controlConfig = {
          camera: this.cameras.main,
          left: this.cursorKeys.left,
          right: this.cursorKeys.right,
          up: this.cursorKeys.up,
          down: this.cursorKeys.down,
          zoomIn: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
          zoomOut: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
          acceleration: 0.06,
          drag: 0.0005,
          maxSpeed: 1.0
      };

      this.cameraControls = this.cameras.addSmoothedKeyControl(controlConfig)

      this.load.image('pointer','assets/pointer.png')

      //this.game.physics.startSystem(Phaser.Physics.P2JS);

      this.client.onScenePreloaded(this)
  }

  create() {
      AGate.Utils.logError("Creating client...")
      this.time.advancedTiming = true
      this.time.desiredFps = 60

     // AGate.Utils.logError(this.time)

      //this.game.physics.startSystem(Phaser.Physics.P2JS)
  }

  onMapLoading(map) {
      AGate.Utils.logError('Scene: onMapLoading')

      this.load.events.on('LOADER_COMPLETE_EVENT', () => {
          this.client.onMapLoaded(map)
          map.isLoaded = true
      })

      this.load.start()
  }

  onMapLoaded(map) {
      AGate.Utils.logError('Scene: onMapLoaded')

      let center = new Location((map.width * Sector.Width) / 2,  (map.height * Sector.Height) / 2).worldToScreen()
      this.player = this.add.sprite(center.x, center.y, 'pointer')
      this.player.setDepth(1)

      this.text = this.add.text(center.x, center.y, 'Phaser')
      this.text.setDepth(1)

      let cam = this.cameras.main
      //cam.setSize(800, 800)
      //cam.setViewport(-50000, -50000, 100000, 100000)
      cam.scrollX = center.x
      cam.scrollY = center.y
      //this.game.physics.p2.enable(this.player)

      //cam.follow(this.player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)
  }
}

class Client {
    constructor(engine, canvas) {
        //super({ key: 'BootScene' })

        this.engine = engine
        this.canvas_ = canvas
        this.assetServer = new AssetServer()
        this.assetServer.start(AGate.getDataPath())

        let self = this
        this.game = new Phaser.Game({
            parent: canvas,
            renderer: Phaser.WEBGL,
            transparent: true,
            //antialias: true,
            multiTexture: true,
            enableDebug: false
        })

        this.scene = new Scene(this)
        this.game.scene.add('default', this.scene)
        this.game.scene.start('default');

        /*game.state.add('boot', new Boot())
        game.state.add('game', new Game())
        game.state.add('menu', new Menu())
        game.state.add('preloader', new Preloader())
        game.state.add('gameover', new Gameover())*/
    }

    get canvas() {
        return this.canvas_
    }

    onScenePreloaded() {
        this.engine.load()
    }

    onMapLoading(map) {
        this.scene.onMapLoading(map)
    }

    onMapLoaded(map) {
        this.scene.onMapLoaded(map)
        map.placeToScene(this.scene)
    }

}

export default Client
