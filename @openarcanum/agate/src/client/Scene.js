// @flow
import Phaser from '../libs/Phaser'

import Isometric from '../libs/phaser-isometric/Isometric'
import Point3 from '../libs/phaser-isometric/Point3'

import Sector from '../shared/map/Sector'
import Location from '../shared/Location'
import Utils from '../shared/misc/Utils'
import Light from './Light'

import Gfx from '../shared/enums/Gfx'

import {Pipeline} from './render/pipeline'
import type ClientEngine from './ClientEngine'
import type Sprite from './Sprite'
import type GameMap from '../shared/map/GameMap'
import type Entity from '../shared/entity/Entity'
import type EventEmitter from '../shared/misc/EventEmitter'

const ShaderTest: string = `outline`
const ShaderTest2: string = `gamma`

export default class Scene extends Phaser.Scene {
  customLoader: boolean
  shaders: Object
  events: EventEmitter

  /**
   *
   * @param client
   */
  constructor(client: ClientEngine) {
    super({ key: `default`})
    this.client = client
    this.engine = client.engine
    this.game = client.game
    //this.renderToTexture = true
    this.customLoader = true
    this.shaders = {}

    //this.engine.events = this.engine.events

    this.engine.events.on(`Map:Loading`, this.onMapLoading, this)
    this.engine.events.on(`Map:Loaded`, this.onMapLoaded, this)
    // this.engine.events.on(`client.started`, super.start, this)
  }

  /**
   *
   * @returns {*}
   */
  getRenderer() {
    return this.game.renderer
  }

  /**
   *
   * @param time
   * @param delta
   */
  update(time: number, delta: number) {
    let pos = this.input.activePointer.positionToCamera(this.cameras.main)
    this.iso.unproject(pos, this.cursorPos)

    //this.client.engine.update()

    /*if (!AGate.Utils.isUndefined(this.player)) {
      //this.player.body.setZeroVelocity()

      if (this.cursorKeys.up.isDown) {
        this.player.body.moveUp(300)
      } else if (this.cursorKeys.down.isDown) {
        this.player.body.moveDown(300)
      }

      if (this.cursorKeys.left.isDown) {
        this.player.body.velocity.x = -300
      } else if (this.cursorKeys.right.isDown) {
        this.player.body.moveRight(300)
      }
    }*/

    if (!Utils.isUndefined(this.cameraControls)) {
      this.cameraControls.update(delta)
    }

    if (this.debugText) {
      let cam = this.cameras.main
      let cur = this.input.activePointer

      this.debugText.setValue([
        //`Cam: ${cam.scrollX}:${cam.scrollY}`,
        //`Cur: ${cur.x}:${cur.y}`,
        //`Pos: ${pos.x}:${pos.y}`,
        `Tile: ${Math.floor(this.cursorPos.x / 40)}:${Math.floor(
          this.cursorPos.y / 40
        )}`

        //`FPS: ${this.time.fps}`
      ])
    } else {
      this.debugText = this.client.guiManager.findWidget(`debugText`)
    }

    let pipeline: Pipeline = this.getRenderer().getPipeline(ShaderTest2)
    if (pipeline) {
      pipeline.setFloat1(`iTime`, time / 1000)
    }
  }

  /**
   *
   */
  render() {
    this.debug.cameraInfo(this.game.camera, 32, 32)
    //this.game.debug.spriteCoords(this.player, 32, 500);
  }

  /**
   *
   */
  preload() {
    Utils.logError(`Preloading client...`)

    //this.scene.loadAsset('tile', 'image', {texture: 'assets/tile.png'});

    this.engine.events.emit(`scene.preloaded`)
  }

  /**
   *
   */
  create() {
    Utils.logError(`Creating client...`)

    // This is used to set a game canvas-based offset for the 0, 0, 0 isometric coordinate - by default
    // this point would be at screen coordinates 0, 0 (top left) which is usually undesirable.

    //this.text = this.add.text(0, 0, 'Phaser');

    this.spriteClickHandler = this.input.makePixelPerfect(/*150*/)
    this.cursorKeys = this.input.keyboard.createCursorKeys()

    const controlConfig = {
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
    }

    this.cameraControls = new Phaser.Cameras.Controls.SmoothedKeyControl(
      controlConfig
    )

    this.isoGroup = this.add.group()
    this.cursorPos = new Point3()
    this.isometric = new Isometric(this, Isometric.ISOMETRIC)

    this.input.on(`gameobjectdown`, (pointer, gameObject) => {
      this.onObjectClick(pointer, gameObject)
    })

    this.lights.enable().setAmbientColor(0x333333)

    let light = this.lights
      .addLight(180, 80, 200)
      .setColor(0xffffff)
      .setIntensity(20)

    this.input.on(`pointermove`, function(pointer) {
      light.x = pointer.worldX
      light.y = pointer.worldY
    })

    this.loadAssets()
    //this.game.physics.startSystem(Phaser.Physics.P2JS);

    this.engine.events.emit(`Scene:Created`)
  }

  async loadAssets() {
    await this.loadShaders()

    this.setCameraShader(ShaderTest2)
  }

  /**
   *
   * @param pointer
   * @param gameObject
   */
  onObjectClick(pointer: Object, gameObject: Object) {
    if (gameObject.data) {
      let sprite = gameObject.data

      if (sprite.data) {
        let data = sprite.data

        const isObject = Utils.isUndefined(data.type)
        if (isObject) {
          this.client.sendInput(`Player:EntitySelect`, {entity: data})
        } else {
          this.client.sendInput(`Player:TileSelect`, {tile: data})
        }



        if (data.type !== `Tile`) {
          this.client.guiManager.addDatGui(data)
        }
      } else {
        this.client.guiManager.addDatGui(sprite)
      }
    }

    gameObject.setTint(0x66eeee)

    gameObject.setPipeline(ShaderTest)

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
  }

  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {
    lll(`Scene: onMapLoading`)

    let dataUrl = AGate.getDataPath(`Gfx/2D`)
    this.loadAsset(`tiles`, `atlas`, {
      texture: `${dataUrl}/Tile/tiles.png`,
      data: `${dataUrl}/Tile/tiles.json`
    })
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {
    lll(`Scene: onMapLoaded`)

    //
    let center = this.iso.projectXY({
      x: (map.width * 40) / 2,
      y: (map.height * 40) / 2
    })

    //this.player = this.add.sprite(center.x, center.y, 'pointer');
    //this.player.setDepth(1);

    //this.text = this.add.text(center.x, center.y, 'Phaser')
    //this.text.setDepth(1)

    //this.game.physics.p2.enable(this.player)

    //cam.follow(this.player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)

    this.setCameraLocation(map.getCenterLocation())

    this.addMap(map)
  }

  /**
   *
   * @param location
   */
  setCameraLocation(location: Location) {
    let cam = this.cameras.main

    let center = new Location(location).worldToScreen()
    //center.x += cam.width / 2;
    //center.y += cam.height / 2;

    //cam.setSize(800, 800)
    //cam.setViewport(-50000, -50000, 100000, 100000)
    cam.scrollX = center.x
    cam.scrollY = center.y
  }

  resizeViewport(width: number, height: number) {
    //this.cameras.main.setViewport(0, 0, width, height, true)
  }

  /**
   *
   * @param name
   */
  setCameraShader(name: string) {
    let shader = this.getShader(name)
    let pipeline: Pipeline = shader.pipeline
    //pipeline.setFloat1('brightPassThreshold', 0.1)

    //console.log('pipeline', pipeline)
    this.cameras.main.setRenderToTexture(pipeline)

    pipeline.setFloat2(`uResolution`, pipeline.width, pipeline.height)
  }

  /**
   *
   * @param tiles
   */
  highlightTiles(tiles: Array<Object>) {
    let color = Math.random() * 16000000

    for (let i = 0; i < tiles.length; i++) {
      let pos = tiles[i]
      let location = new Location(pos[1], pos[0])

      let sector = this.engine.map.getSector(location.sectorX, location.sectorY)

      if (!sector || !sector.tiles) {
        continue
      }

      let tile = sector.getTile(location.tileX, location.tileY)
      if (!tile || !tile.sprite) {
        continue
      }

      tile.sprite.setTint(color)
      //tile.sprite.setBlendMode('BlendAdd');

      //tile.sprite.sprite.alpha = 0.7;
    }
  }

  /**
   *
   * @param map
   * @param target
   */
  addMap(map: GameMap/*, target: Object = this*/) {
    Utils.logError(`Placing to scene: ${map.path}`)

    map.rootGroup = this.add.group()
    map.rootGroup.autoCull = true

    let sectors = map.getActiveSectors()

    let sortGroups = []
    for (let sector of sectors) {
      this.addSector(sector, map.rootGroup)
      sortGroups.push(sector.staticGroup)
    }



    /*for (let col = 0; col < map.height; col++) {
      for (let row = 0; row < map.width; row++) {
        let sector = map.sectors[col][row]

        if (sector) {
          this.addSector(sector, map.rootGroup)
          sortGroups.push(sector.staticGroup)
        }
      }
    }*/




    //sortGroups(sortGroups)
  }

  /**
   *
   * @param sector
   * @param target
   */
  addSector(sector: Sector, target: Object) {
    if (!sector.tiles) {
      lll('Invalid sector')
      return
    }

    // Add tiles
    sector.tileGroup = this.add.group(target) //new Phaser.GameObjects.Group(target.scene);
    //target.add(this.tileGroup);

    let ax = sector.x * Sector.Width * Sector.TileWidthHalf
    let ay = sector.y * Sector.Height * Sector.TileWidthHalf

    lll('Adding sector to scene', ax, ay)
    for (let y = 0; y < Sector.Height; y++) {
      let dx = ax
      for (let x = 0; x < Sector.Width; x++) {
        let tile = sector.getTile(x, y)
        if (!tile) {
          lll('No tile for sector')
          continue
        }

        if (tile.type) {
          this.addSprite(tile.sprite, sector.tileGroup, ay, dx, 0, [0, 20])
          //tile.sprite.setPipeline('Light2D')
          tile.sprite.setData(tile)
        }

        /*if ((x % 2 == 0) || (y % 2 == 0)) {
          tile.sprite.sprite.setTint(0xaaaaaa);
        }*/

        dx += Sector.TileWidthHalf
      }

      ay += Sector.TileWidthHalf
    }

    if (sector.lights) {
      for (let light of sector.lights) {
        this.addLight(light, this)
      }
    }

    // Add static objects
    sector.staticGroup = this.add.group(target) //new Phaser.GameObjects.Group(target.scene);
    //target.add(this.staticGroup);

    sector.entities.forEach(entity => {
      /*let baseComponent = entity.base;
      let location = new Location(baseComponent.location);

      let tile = this.getTile(location.tileX, location.tileY);
      if (tile)
        tile.entities.push(entity);*/

      this.addEntity(entity, sector.staticGroup)
    })

    // Sort objects
    //target.scene.sortGroup(this.staticGroup);
  }

  /**
   *
   * @param entity
   * @param target
   */
  addEntity(entity: Entity, target: Object) {
    let baseComponent = entity.base
    let location = new Location(baseComponent.location)

    let visualComponent = entity.visual
    if (!visualComponent || !visualComponent.classes) {
      return
    }

    let visualClass = visualComponent.classes.current
    if (Utils.isUndefined(visualClass)) {
      visualClass = visualComponent.classes.normal
    }

    if (Utils.isUndefined(visualClass)) {
      return
    }

    let sprite = visualClass.sprite

    if (Utils.isUndefined(sprite)) {
      return
    }

    let offset = baseComponent.offset
    /*if (AGate.Utils.isArray(offset)) {
      offset = {x: offset[0], y: offset[1]};
    }*/

    let x = location.x * Sector.TileWidthHalf
    let y = location.y * Sector.TileWidthHalf

    if (sprite.type === Gfx.Types.Wall) {
      switch (
        sprite.currentStage // Counter clockwise
      ) {
        case `NorthEast`:
          // South east, indoor (Up right)
          //x += 20; //(Sector.TileWidth / 2) - 1
          y -= Sector.TileWidthHalf //(Sector.TileHeight / 2)
          break
        case `SouthEast`:
          // South west, outdoor
          //x -= 20;
          //offset.y -= 40;
          break
        case `SouthWest`:
          // South east, outdoor (Down left)
          //offset.x -= 20;
          //offset.y -= 20;
          break

        case `NorthWest`:
          // South west, indoor (Up left)
          x -= Sector.TileWidthHalf //(Sector.TileWidth / 2) + 1
          //y -= 20; //(Sector.TileHeight / 2)
          break
      }
    } else if (sprite.type === Gfx.Types.Portal) {
      switch (
        sprite.side // Counter clockwise
      ) {
        case 1:
          // South east, indoor (Up right)
          //x += 40; //(Sector.TileWidth / 2) - 1
          y -= Sector.TileWidthHalf //(Sector.TileHeight / 2)
          break
        case 3:
          // South west, outdoor
          //x -= 20;
          //y -= 40;
          break
        case 5:
          // South east, outdoor (Down left)
          //x -= 20;
          //y -= 20;
          break

        case 7:
          // South west, indoor (Up left)
          x -= Sector.TileWidthHalf //(Sector.TileWidth / 2) + 1
          //y -= 20; //(Sector.TileHeight / 2)
          break
      }
    } else {
    }

    this.addSprite(
      sprite,
      target,
      x,
      y,
      0 /*position.y / 64 + position.x*/,
      offset
    )
    sprite.setData(entity)

    // Process render components
    let renderComponent = visualComponent.render
    if (renderComponent) {
      // Process render flags
      if (renderComponent.flags) {
        let flags = renderComponent.flags

        for (let flag of flags) {
          switch (flag) {
            case `BlendAdd`:
            case `BlendMul`:
              sprite.setBlendMode(flag)
              break
          }
        }
      }
    }

    let lightComponent = visualComponent.light
    if (lightComponent) {
      if (lightComponent.color) {
        //sprite.setTint(color);

        entity.light = this.addLight(
          lightComponent,
          this,
          baseComponent.location
        )
      }
    }
  }

  /**
   *
   * @param sprite
   * @param target
   * @param x
   * @param y
   * @param z
   * @param offset
   */
  addSprite(
    sprite: Sprite,
    target: Object,
    x: number,
    y: number,
    z: number = 0,
    offset: Object = null
  ) {
    sprite.addToScene(target, x, y, z, offset)
  }

  /**
   *
   * @param light
   * @param target
   * @param location
   */
  addLight(light: Object, target: Object, location: ?Location = null) {
    if (!location) {
      location = light.location
    }

    if (!location) {
      lll(`wrong light`)
      return null
    }

    let pos = this.iso.unprojectAbsolute({
      x: location[0],
      y: location[1]
    })

    if (light.offset) {
      pos.x += light.offset[0]
      pos.y += light.offset[1]
    }

    let color = Scene.stringToColor(light.color)

    let resultLight = new Light()
    let light2 = this.lights.addLight(pos.x, pos.y, 200, 0xffffff, 200.0)

    //resultLight.instance =light2
    //light2.setIntensity(1.5)
    //light2.setColor(color)

    //lll(`light`, resultLight, location, pos)
    return resultLight
  }

  /**
   *
   * @param name
   * @returns {*}
   */
  getShader(name: string): Object {
    let descriptor = this.shaders[name]
    if (!descriptor.pipeline) {
      descriptor.pipeline = this.game.renderer.addPipeline(
        name,
        new Pipeline(this.game, descriptor.vertex, descriptor.fragment)
      )
    }

    return descriptor
  }

  /**
   *
   * @param name
   * @returns {Promise<void>}
   */
  async addShader(name: string) {
    let dataUrl = AGate.getAppPath(`shader`)
    return this.loadAsset(name, `shader`, {
      fragment: `${dataUrl}/${name}.fragment.glsl`,
      vertex: `${dataUrl}/${name}.vertex.glsl`
    })
  }

  /**
   *
   * @param name
   * @returns {Promise<void>}
   */
  async loadShaders() {
    let dataUrl = AGate.getAppPath(`shader`)
    let files = await this.engine.assetLoader.findFiles(
      dataUrl,
      `.fragment.glsl`
    )

    let promises = []
    for (let file of files) {
      let path = file.replace(`.fragment.glsl`, ``)
      let name = Utils.getFileName(path)

      promises.push(
        this.loadAsset(name, `shader`, {
          fragment: file,
          vertex: path + `.vertex.glsl`
        })
      )
    }

    return Promise.all(promises)
  }

  /**
   * Adds asset to the loader
   * @param key
   * @param type
   * @param options
   * @returns {boolean}
   */
  async loadAsset(
    key: string,
    type: string,
    options: Object
  ): Promise<boolean> {
    if (this.engine.assetLoader.hasAsset(key)) {
      return true
    }

    let descriptor = Utils.merge(options, { key, type })

    let loaded = await this.engine.assetLoader.loadAsset(descriptor)
    if (!loaded) {
      return false
    }

    switch (descriptor.type) {
      case `atlas`: {
        let textures = this.sys.textures
        let texture = textures.addAtlas(
          descriptor.key,
          descriptor.image,
          descriptor.meta
        )
        let frames = descriptor.meta[`frames`]

        for (let key in frames) {
          let frameInfo = frames[key]
          let delta = frameInfo.delta
          let center = frameInfo.center

          let frame = texture.get(key)

          //center = this.iso.unprojectAbsolute(center);

          if (center) {
            frame.centerX = center.x
            frame.centerY = center.y
          }
        }

        break
      }
      case `shader`: {
        //console.error(`shader`,  descriptor.vertex, descriptor.fragment)

        this.shaders[key] = descriptor
        break
      }
    }

    //this.engine.assetLoader.preload(data);
    return true
  }

  /**
   *
   * @param groups
   */
  sortGroups(groups: Array<Object>) {
    this.iso.topologicalSort(groups)
  }

  /**
   * Adds isometric sprite to scene
   * @param x
   * @param y
   * @param z
   * @param key
   * @param frame
   * @param group
   * @param offset
   * @returns {IsoSprite}
   */
  /*
  addIsoSprite(
    x: number,
    y: number,
    z: number,
    key: string,
    frame: number,
    group: Object,
    offset: ?Object = null
  ): IsoSprite {
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
  /*
    let sprite = new IsoSprite(this, x, y, z, key, frame, offset)

    //sprite.displayOriginX = delta.x;
    //sprite.displayOriginY = delta.y;

    //this.physics.world.enableBody(sprite);

    //this.add.displayList.add(sprite);
    //this.add.updateList.add(sprite);

    group.add(sprite, true)
    return sprite
  }*/

  static stringToColor(value) {
    if (value.startsWith(`rgba`) || value.startsWith(`rgb`)) {
      let values = value.substring(
        value.indexOf(`(`) + 1,
        value.indexOf(`)`) - 1
      )
      values = values.split(`,`)

      let r = Utils.parseInt(values[0])
      let g = Utils.parseInt(values[1])
      let b = Utils.parseInt(values[2])
      let a = values.length > 3 ? Utils.parseInt(values[3]) : 255

      //console.log(r, g, b, a);

      return Phaser.Display.Color.GetColor32(r, g, b, a)

      /*var result = (/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)$/).exec(rgb.toLowerCase());

      if (result)
      {
        var r = parseInt(result[1], 10);
        var g = parseInt(result[2], 10);
        var b = parseInt(result[3], 10);
        var a = (result[4] !== undefined) ? parseFloat(result[4]) : 1;

        color.setTo(r, g, b, a * 255);
      }*/
    }
  }
}
