import AGate from '../agate'
import Phaser from '../libs/phaser'

import { Isometric } from '../libs/phaser-isometric/Isometric'
import { Point3 } from '../libs/phaser-isometric/Point3'
import { IsoSprite } from '../libs/phaser-isometric/IsoSprite'
import { Location, Sector } from '../shared/GameMap'

const dat = AGate.requireNode('dat.gui');

export class Scene extends Phaser.Scene {
    constructor(client) {
        super({ key: 'default' })
        this.client = client
        this.game = client.game
        this.loadedAssets = {}
        this.renderToTexture = true

        this.datGui = new dat.GUI();

        this.datGui.add(this, 'renderToTexture')
    }

    loadAsset(key, type, options) {
      if (this.loadedAssets.hasOwnProperty(key)) {
          return true
      }

      let data = AGate.Utils.merge(options, { 'key': key })

      this.load[type].call(this.load, /*data*/ key, options.texture, options. data)
      this.loadedAssets[key] = type
  }

  update(time, delta) {
      var pos = this.input.activePointer.positionToCamera(this.cameras.main)

      // Update the cursor position.
      // It's important to understand that screen-to-isometric projection means you have to specify a z position manually, as this cannot be easily
      // determined from the 2D pointer position without extra trickery. By default, the z position is 0 if not set.
      this.iso.unproject(pos, this.cursorPos);

      this.client.engine.update()

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
          let cur = this.input.activePointer;

          this.text.setText([
              `Cam: ${cam.scrollX}:${cam.scrollY}`,
              `Cur: ${cur.x}:${cur.y}`,
              `Pos: ${pos.x}:${pos.y}`,
              `Tile: ${this.cursorPos.x}:${this.cursorPos.y}`

              //`FPS: ${this.time.fps}`
          ])
      }
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

      //this.scene.loadAsset('tile', 'image', {texture: 'assets/tile.png'});

      //this.game.physics.startSystem(Phaser.Physics.P2JS);

      this.client.onScenePreloaded(this)
  }


  addIsoSprite(x, y, z, key, frame, group) {
      var sprite = new IsoSprite(this, x, y, z, key, frame);

      //this.physics.world.enableBody(sprite);

      //this.add.displayList.add(sprite);
      //this.add.updateList.add(sprite);

      group.add(sprite, true);
      return sprite;
  }

  create() {
      AGate.Utils.logError("Creating client...")
      // This is used to set a game canvas-based offset for the 0, 0, 0 isometric coordinate - by default
      // this point would be at screen coordinates 0, 0 (top left) which is usually undesirable.

      this.text = this.add.text(0, 0, 'Phaser')

      this.isoGroup = this.add.group();

      this.cursorPos = new Point3();

      this.isometric = new Isometric(this, Isometric.ISOMETRIC);
      //this.game.iso.anchor.setTo(0.5, 0.2);

      //this.spawnTiles();

      this.input.events.on('GAME_OBJECT_DOWN_EVENT', function (event) {
          event.gameObject.setTint(Math.random() * 16000000);
      });

  }

  onMapLoading(map) {
      AGate.Utils.logError('Scene: onMapLoading')

      var dataUrl = AGate.getDataUrl('Gfx/2D')
      this.loadAsset('tiles', 'atlas', {texture: `${dataUrl}/Tile/tiles.png`, data: `${dataUrl}/Tile/tiles.json`})

      this.load.events.on('LOADER_COMPLETE_EVENT', () => {
          this.client.onMapLoaded(map)
          map.isLoaded = true
      })

      this.load.start()
  }

  onMapLoaded(map) {
      AGate.Utils.logError('Scene: onMapLoaded')

      //let center = new Location((map.width * Sector.Width) / 2,  (map.height * Sector.Height) / 2).worldToScreen()
      let center = this.iso.projectXY({x: (map.width * Sector.Width) / 2, y: (map.height * Sector.Height) / 2})
      this.player = this.add.sprite(center.x, center.y, 'pointer')
      this.player.setDepth(1)

      //this.text = this.add.text(center.x, center.y, 'Phaser')
      //this.text.setDepth(1)

      let cam = this.cameras.main
      //cam.setSize(800, 800)
      //cam.setViewport(-50000, -50000, 100000, 100000)
      cam.scrollX = center.x + 100
      cam.scrollY = center.y + 100
      //this.game.physics.p2.enable(this.player)

      //cam.follow(this.player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)
  }

  spawnTiles(){
      var tile;
      for (var xx = 0; xx < 64; xx++) {
          for (var yy = 0; yy < 64; yy++) {
              tile = this.addIsoSprite(xx * 38, yy * 38, 0, 'tile', 0, this.isoGroup);
              tile.anchor.x = 0.5;
          }
      }
  }
}
