/* global AGate */
import Phaser from '../libs/phaser';

import {Isometric} from '../libs/phaser-isometric/Isometric';
import {Point3} from '../libs/phaser-isometric/Point3';
import {IsoSprite} from '../libs/phaser-isometric/IsoSprite';

import {Sector} from '../shared/map/Sector';
import {Location} from '../shared/Location';

const dat = AGate.requireNode('dat.gui');

let DatConfig = {
  Entity: {
    exclude: ['systems', 'ecs', 'map']
  }

}


export class Scene extends Phaser.Scene {

  constructor(client) {
    super({key: 'default'});
    this.client = client;
    this.engine = client.engine;
    this.game = client.game;
    //this.renderToTexture = true

    this.customLoader = true;
  }

  /**
   *
   * @param object
   * @param parent
   * @param maxDepth
   */
  addDatGui(object, parent, maxDepth = 3) {
    if (AGate.Utils.isNil(parent)) {
      if (!AGate.Utils.isNil(this.datGui))
        this.datGui.destroy();

      this.datGui = new dat.GUI();
    }

    //this.datGui.add(this, 'renderToTexture')
    parent = parent || this.datGui;

    //parent.open();

    for (let key in object) {
      if (key.charAt(0) === '_')
        continue;

      let value = object[key];
      if (AGate.Utils.isNil(value))
        continue;

      if (AGate.Utils.isObjectLike(value)) {
        if (maxDepth > 0) {
          let folder = parent.addFolder(key);
          this.addDatGui(value, folder, maxDepth - 1);
        }
      } else if (AGate.Utils.isArray(value)) {

      } else {
        if (!AGate.Utils.isFunction(value))
          parent.add(object, key);
      }
    }
  }

  /**
   * Adds asset to the loader
   * @param key
   * @param type
   * @param options
   * @returns {boolean}
   */
  async loadAsset(key, type, options) {
    if (this.engine.assetLoader.hasAsset(key)) {
      return true;
    }

    let descriptor = AGate.Utils.merge(options, {'key': key, 'type': type});
    let textures = this.sys.textures;

    let loaded = await this.engine.assetLoader.loadAsset(descriptor);
    if (!loaded)
      return false;

    switch (descriptor.type) {
      case 'atlas':
        let texture = textures.addAtlas(descriptor.key, descriptor.image, descriptor.meta);
        let frames = descriptor.meta['frames'];

        for (let key in frames) {
          let frameInfo = frames[key];
          let delta = frameInfo.delta;
          let center = frameInfo.center;

          let frame = texture.get(key);

          //center = this.iso.unprojectAbsolute(center);

          if (center) {
            frame.centerX = center.x;
            frame.centerY = center.y;
          }
        }

        break;
    }

    //this.engine.assetLoader.preload(data);
    return true;
  }

  /**
   * Starts loading of scene assets for given map
   * @param map
   */
  /*async startLoader(map) {
    if (this.customLoader) {
      let textures = this.sys.textures;

      let result = await this.engine.assetLoader.loadAssets(null, (descriptor) => {
        switch (descriptor.type) {
          case 'atlas':
            let texture = textures.addAtlas(descriptor.key, descriptor.image, descriptor.meta);
            let frames = descriptor.meta['frames'];

            for (let key in frames) {
              let frameInfo = frames[key];
              let delta = frameInfo.delta;
              let center = frameInfo.center;

              let frame = texture.get(key);

              //center = this.iso.unprojectAbsolute(center);

              if (center) {
                frame.centerX = center.x;
                frame.centerY = center.y;
              }
            }

            break;
        }
      });

      this.client.onMapLoaded(map);
      map.isLoaded = true;

    } else {
      this.load.on('complete', () => {
        this.client.onMapLoaded(map);
        map.isLoaded = true;
      });

      this.load.start();
    }

  }*/

  /**
   * Adds isometric sprite to scene
   * @param x
   * @param y
   * @param z
   * @param key
   * @param frame
   * @param group
   * @returns {IsoSprite}
   */
  addIsoSprite(x, y, z, key, frame, group, offset = null) {
    /*let textures = this.sys.textures;
    let texture = textures.get(key);
    let frameData = texture.get(frame);

    if (!offset) {
      offset = {x: 0, y: 0};
    }

    if (frameData.delta) {
     // offset.x = offset.x - (frameData.delta.x);
      //offset.y = offset.y - (frameData.delta.y);
    }*/

    /*if (offset) {
      offset = this.iso.unprojectAbsolute(offset);

      x += offset.y;
      y += offset.x;
    }*/

    let sprite = new IsoSprite(this, x, y, z, key, frame, offset);

    //sprite.displayOriginX = delta.x;
    //sprite.displayOriginY = delta.y;


    //this.physics.world.enableBody(sprite);

    //this.add.displayList.add(sprite);
    //this.add.updateList.add(sprite);

    group.add(sprite, true);
    return sprite;
  }

  /**
   *
   * @param group
   */
  sortGroups(groups) {
    this.iso.topologicalSort(groups);
  }

  /**
   *
   * @param time
   * @param delta
   */
  update(time, delta) {
    var pos = this.input.activePointer.positionToCamera(this.cameras.main);
    this.iso.unproject(pos, this.cursorPos);

    this.client.engine.update();

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
      this.cameraControls.update(delta);
    }


    if (this.debugText) {
      let cam = this.cameras.main;
      let cur = this.input.activePointer;

      this.debugText.setValue([
        //`Cam: ${cam.scrollX}:${cam.scrollY}`,
        //`Cur: ${cur.x}:${cur.y}`,
        //`Pos: ${pos.x}:${pos.y}`,
        `Tile: ${Math.floor(this.cursorPos.x / 40)}:${Math.floor(this.cursorPos.y / 40)}`,

        //`FPS: ${this.time.fps}`
      ]);
    } else {
      this.debugText = this.client.guiManager.findWidget('debugText');
    }
  }

  /**
   *
   */
  render() {
    this.debug.cameraInfo(this.game.camera, 32, 32);
    //this.game.debug.spriteCoords(this.player, 32, 500);
  }

  /**
   *
   */
  preload() {
    AGate.Utils.logError('Preloading client...');
    this.cursorKeys = this.game.input.keyboard.createCursorKeys();

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
      maxSpeed: 1.0,
    };

    this.cameraControls = new Phaser.Cameras.Controls.Smoothed(controlConfig);

    //this.scene.loadAsset('tile', 'image', {texture: 'assets/tile.png'});

    //this.game.physics.startSystem(Phaser.Physics.P2JS);

    this.engine.onPreloaded();
  }

  /**
   *
   */
  create() {
    AGate.Utils.logError('Creating client...');
    // This is used to set a game canvas-based offset for the 0, 0, 0 isometric coordinate - by default
    // this point would be at screen coordinates 0, 0 (top left) which is usually undesirable.

    //this.text = this.add.text(0, 0, 'Phaser');

    this.isoGroup = this.add.group();

    this.cursorPos = new Point3();

    this.isometric = new Isometric(this, Isometric.ISOMETRIC);

    //this.spawnTiles();

    this.input.on('gameobjectdown', (pointer, gameObject) => {
      //console.log(gameObject);

      if (gameObject.data) {
        let sprite = gameObject.data;

        if (sprite.data) {
          this.addDatGui(sprite.data);
        } else {
          this.addDatGui(sprite);
        }
      }

      gameObject.setTint(Math.random() * 16000000);

      /*gameObject.tween = this.tweens.add({
        targets: gameObject,
        props: {
          isoZ: 30.0,
        },
        ease: 'Quad.easeInOut',
        duration: 1000,
        repeat: -1,
        repeatDelay: 1000,
        yoyo: true,
        onUpdate: (data) => {
          gameObject._project();
        },
      });

      gameObject.tween.play();*/

    });

    //this.lights.enable();
    //this.lights.setAmbientColor(0x666666);

  }

  /**
   *
   * @param map
   */
  onMapLoading(map) {
    AGate.Utils.logError('Scene: onMapLoading');

    var dataUrl = AGate.getDataPath('Gfx/2D');
    this.loadAsset('tiles', 'atlas', {
      texture: `${dataUrl}/Tile/tiles.png`,
      data: `${dataUrl}/Tile/tiles.json`,
    });

    //this.startLoader(map);
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map) {
    AGate.Utils.logError('Scene: onMapLoaded');

    //
    let center = this.iso.projectXY(
      {x: (map.width * 40) / 2, y: (map.height * 40) / 2});

    //this.player = this.add.sprite(center.x, center.y, 'pointer');
    //this.player.setDepth(1);

    //this.text = this.add.text(center.x, center.y, 'Phaser')
    //this.text.setDepth(1)



    //this.game.physics.p2.enable(this.player)

    //cam.follow(this.player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)

    this.setCameraLocation([(map.width / 2) * 64,  (map.height / 2) * 64]);
  }

  setCameraLocation(location) {
    let cam = this.cameras.main;

    let center = new Location(location).worldToScreen();
    //center.x += cam.width / 2;
    //center.y += cam.height / 2;

    //cam.setSize(800, 800)
    //cam.setViewport(-50000, -50000, 100000, 100000)
    cam.scrollX = center.x;
    cam.scrollY = center.y;
  }

  highlightTiles(tiles) {
    let color = Math.random() * 16000000;
    let sectors = this.engine.map.sectors;

    for (let i = 0; i < tiles.length; i++) {
      let pos = tiles[i];
      let location = new Location(pos[1], pos[0]);


      let sector = sectors[location.sectorY][location.sectorX];
      if (!sector || !sector.tiles)
        continue;

      let tile = sector.tiles[location.tileY][location.tileX];
      if (!tile || !tile.sprite)
        continue;

      tile.sprite.setTint(color);
      //tile.sprite.setBlendMode('BlendAdd');

      //tile.sprite.sprite.alpha = 0.7;
    }
  }


}
