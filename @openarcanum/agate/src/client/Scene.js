// @flow
import PIXI from './libs/PIXI'

import Isometric from './isometric/Isometric'
import Point3 from './isometric/Point3'

import Sector from '../shared/map/Sector'
import Location from '../shared/Location'
import Utils from '../shared/misc/Utils'
import Light from './Light'
import Sprite from './Sprite'

import Gfx from '../shared/enums/Gfx'

import type ClientEngine from './ClientEngine'
import type GameMap from '../shared/map/GameMap'
import type Entity from '../shared/entity/Entity'
import type EventEmitter from '../shared/misc/EventEmitter'
import type GameEngine from '../shared/GameEngine'
import type AssetLoader from '../shared/assets/AssetLoader'
import Renderer from './Renderer'
import Camera from './Camera'
import Vec2 from '../shared/misc/Vec2';

const ShaderTest: string = `outline`
const ShaderTest2: string = `gamma`

export default class Scene {
  customLoader: boolean
  events: EventEmitter
  gameEngine: GameEngine
  client: ClientEngine
  assetLoader: AssetLoader
  renderer: Renderer

  /**
   *
   * @param client
   */
  constructor(client: ClientEngine) {
    //super({ key: `default`})
    this.client = client
    this.gameEngine = client.gameEngine

    //this.renderToTexture = true
    this.customLoader = true

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    // this.gameEngine.events.on(`client.started`, super.start, this)

    this.events.on(`Sector:Loading`, this.onSectorLoading, this)

    //this.events.on('Map.NewEntity', this.onNewEntity, this)

    //this.events.on('Player:Joined', this.onPlayerJoined, this)
    this.events.on(`Object:Click`, this.onObjectClick, this)
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
   * @param time
   * @param delta
   */
  update(time: number, delta: number) {
    //let pos = this.input.activePointer.positionToCamera(this.cameras.main)
    //this.iso.unproject(pos, this.cursorPos)
    /*if (!Utils.isUndefined(this.cameraControls)) {
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
    }*/
  }

  /**
   *
   */
  render() {
    //this.debug.cameraInfo(this.game.camera, 32, 32)
    //this.game.debug.spriteCoords(this.player, 32, 500);
  }

  async start() {
    this.renderer.start()
  }

  /**
   *
   */
  preload() {
    llll(`Preloading scene...`)

    //this.scene.loadAsset('tile', 'image', {texture: 'assets/tile.png'});

    this.events.emit(`Scene:Preloaded`)
  }

  /**
   *
   */
  async create(canvas: HTMLCanvasElement) {
    lll(`Creating scene...`)

    // This is used to set a game canvas-based offset for the 0, 0, 0 isometric coordinate - by default
    // this point would be at screen coordinates 0, 0 (top left) which is usually undesirable.

    //this.text = this.add.text(0, 0, 'Phaser');

    this._canvas = canvas

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

    let myCustomContext = canvas.getContext(`webgl2`, contextCreationConfig)

    this.pixi = new PIXI.Application({
      ...this.client.getWindowRect(),
      autoStart: false,
      view: canvas,
      transparent: true,
      resolution: window.devicePixelRatio || 1
    })

    this.pixi.ticker.stop()

    // create the renderer
    this.renderer = new Renderer(this.client)
    await this.renderer.init()

    this.camera = new Camera(this.renderer.viewport)

    let stage = this.renderer.stage
    stage.interactive = true

    /*

    stage.on(`pointerdown`, (event) => {
      let { global } = event.data

      console.log(event)

      let point = this.isometric.projector.unproject(global)

    })*/

    this.resizeViewport(this.pixi.screen.width, this.pixi.screen.height)

    //this.isoGroup = this.add.group()
    this.cursorPos = new Point3()
    this.isometric = new Isometric(this, Isometric.ISOMETRIC)

    /*

    this.lights.enable().setAmbientColor(0x333333)

    let light = this.lights
      .addLight(180, 80, 200)
      .setColor(0xffffff)
      .setIntensity(20)

    this.input.on(`pointermove`, function(pointer) {
      light.x = pointer.worldX
      light.y = pointer.worldY
    })*/

    await this.loadAssets()
    //this.game.physics.startSystem(Phaser.Physics.P2JS);

    this.events.emit(`Scene:Created`)
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
    return this.client.loadAsset(key, type, options, target)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadAssets() {
    //await this.loadShaders()
    //this.setCameraShader(ShaderTest2)

    let tiles = new Sprite(this)

    let dataUrl = AGate.getDataPath(`Gfx/2D`)
    await tiles.loadSpritesheet(`tiles`, {
      texture: `${dataUrl}/Tile/tiles.png`,
      data: `${dataUrl}/Tile/tiles.json`
    })
  }

  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {
    lll(`Scene: onMapLoading`)

    map.onNewEntity = async (entity) => this.onNewEntity(entity)
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

    this.setCameraLocation(map.getCenterLocation())

    this.addMap(map)
  }

  /**
   *
   * @param tile
   * @returns {Promise<void>}
   */
  onSectorLoading(sector) {
    sector.onTileLoad = async (tile) => {
      if (tile.type) {
        tile.sprite = new Sprite(this)
        await tile.sprite.load(tile)
      }
    }
  }

  /**
   *
   * @param entity
   * @param visualClass
   * @returns {Function}
   */
  /*loadSprite(entity: Entity, visualClass) {
    return async () => {
      let sprite = new Sprite(this)
      sprite.setData(entity)

      sprite.load(visualClass)
      visualClass.sprite = sprite
    }
  }*/

  /**
   *
   *
   * @param entity
   * @returns {Promise<void>}
   */
  async onNewEntity(entity: Entity) {
    let sprites = []
    let visualComponent = entity.visual
    if (visualComponent) {
      let visualClasses = visualComponent.classes

      //lll('dfdfd', visualClasses)

      for (let className: string in visualClasses) {
        if (className.charAt(0) === '_') { // TODO: Hack. Use function to check if prop is private
          continue
        }


        let visualClass = visualClasses[className]

        let sprite = new Sprite(this)
        sprite.setData(entity)
        visualClass.sprite = sprite

        sprites.push(sprite.load(visualClass))

        //lll(`loaded visual`, entity.base.type)
      }
    }

    return Promise.all(sprites)
  }

  /**
   *
   * @param pointer
   * @param gameObject
   */
  onObjectClick(gameObject: Object) {
    lll(gameObject)
    if (gameObject.data) {
      let data = gameObject.data

      const isObject = Utils.isUndefined(data.type)
      if (isObject) {
        this.client.sendInput(`Player:EntitySelect`, { entity: data })
      } else {
        this.client.sendInput(`Player:TileSelect`, { tile: data })
      }

      if (data.type !== `Tile`) {
        this.client.guiManager.addDatGui(data)
      }
    } else {
      this.client.guiManager.addDatGui(gameObject)
    }

    gameObject.setTint(0x66eeee)

    //gameObject.setPipeline(ShaderTest)

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
   * @param player
   * @param map
   * @returns {Promise<void>}
   */
  async onPlayerJoined(player, map) {
    await this.onNewEntity(player)
    this.addEntity(player, map.rootGroup)

    this.sortGroup(map.rootGroup)
  }

  /**
   *
   * @param location
   */
  setCameraLocation(location: Location) {
    let center = location.worldToScreen()
    //center.x += cam.width / 2;
    //center.y += cam.height / 2;

    //cam.setSize(800, 800)
    //cam.setViewport(-50000, -50000, 100000, 100000)

    this.renderer.stage.moveCenter(center.x, center.y)
  }

  resizeViewport(width: number, height: number) {
    //this.camera
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
    //this.cameras.main.setRenderToTexture(pipeline)

    pipeline.setFloat2(`uResolution`, pipeline.width, pipeline.height)
  }

  /**
   *
   * @param tiles
   */
  highlightTiles(tiles: Array<Object>) {
    return
    let color = Math.random() * 16000000

    for (let i = 0; i < tiles.length; i++) {
      let pos = tiles[i]
      let location = new Location(pos[1], pos[0])

      let sector = this.gameEngine.map.getSector(
        location.sectorX,
        location.sectorY
      )

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

  newGroup(parent) {
    if (!parent) {
      parent = this.renderer.stage
    }

    let container = new PIXI.Container()
    //container.sortableChildren = true
    //container.interactive = true
    parent.addChild(container)

    return container
  }

  sortGroup(group) {
    group.sortChildren()
  }

  /**
   *
   * @param map
   * @param target
   */
  addMap(map: GameMap /*, target: Object = this*/) {
    lll(`Placing to scene: ${map.path}`)

    let rootGroup = this.newGroup()

    let sectors = map.getActiveSectors()

    let sortGroups = []
    for (let sector of sectors) {
      this.addSector(sector, rootGroup)
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

    map.rootGroup = rootGroup
  }

  /**
   *
   * @param sector
   * @param target
   */
  addSector(sector: Sector, target: Object) {
    if (!sector.tiles) {
      lll(`Invalid sector`)
      return
    }

    // Add tiles
    sector.tileGroup = this.newGroup(target)

    let ax = sector.x * Sector.Width * Sector.TileHeight
    let ay = sector.y * Sector.Height * Sector.TileHeight

    let offset = new Vec2(0, 39)
    lll(`Adding sector to scene`, ax, ay)
    for (let y = 0; y < Sector.Height; y++) {
      let dx = ax
      for (let x = 0; x < Sector.Width; x++) {
        let tile = sector.getTile(x, y)
        if (!tile) {
          lll(`No tile for sector`)
          continue
        }

        if (
          tile.type &&
          (tile.type == `Facade` || tile.end.category != `BlackYall`)
        ) {
          this.addSprite(tile.sprite, sector.tileGroup, ay, dx, 0, offset)
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
    sector.staticGroup = this.newGroup(target)
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

    this.sortGroup(sector.staticGroup)
  }

  /**
   *
   * @param entity
   * @param target
   */
  addEntity(entity: Entity, target: Object) {
    let baseComponent = entity.base
    let location = baseComponent.location

    let visualComponent = entity.visual
    if (!visualComponent || !visualComponent.classes) {
      return
    }

    let visualClass = visualComponent.classes.current
    if (Utils.isUndefined(visualClass)) {
      visualClass = visualComponent.classes.normal
    }

    if (Utils.isUndefined(visualClass)) {
      lll(`No visual`, entity)
      return
    }

    let sprite = visualClass.sprite

    if (Utils.isUndefined(sprite)) {
      lll(`No sprite`, entity)
      return
    }

    let offset = baseComponent.offset
    /*if (AGate.Utils.isArray(offset)) {
      offset = {x: offset[0], y: offset[1]};
    }*/

    let x = location.x * Sector.TileHeight
    let y = location.y * Sector.TileHeight

    if (sprite.type === Gfx.Types.Wall) {
      //lll('entity offset', offset)
      switch (
        sprite.stage // Counter clockwise
      ) {
        case `NorthEast`:
          // South east, indoor (Up right)
          //x += 20; //(Sector.TileWidth / 2) - 1
          y -= Sector.TileWidthHalf //(Sector.TileHeight / 2)
          //x -= 1
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
          //y -= 1
          //y -= 20; //(Sector.TileHeight / 2)
          break
      }
    } else if (sprite.type === Gfx.Types.Portal) {
      switch (
        sprite.meta.side // Counter clockwise
      ) {
        case 1:
          // South east, indoor (Up right)
          //x += 40; //(Sector.TileWidth / 2) - 1
          y -= Sector.TileHeight //(Sector.TileHeight / 2)
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
          x -= Sector.TileHeight //(Sector.TileWidth / 2) + 1
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

        //lll('render flags', renderComponent)
        let flags = renderComponent.flags

        for (let flag of flags) {
          lll('render flags', flag)
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
    // lll('adding sprite to scene')

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

    let pos = this.isometric.projector.unprojectAbsolute({
      x: location.x,
      y: location.y
    })

    if (light.offset) {
      pos.x += light.offset.x
      pos.y += light.offset.y
    }

    let color = Scene.stringToColor(light.color)

    let resultLight = new Light()
    //let light2 = this.lights.addLight(pos.x, pos.y, 200, 0xffffff, 200.0)

    //resultLight.instance =light2
    //light2.setIntensity(1.5)
    //light2.setColor(color)

    //lll(`light`, resultLight, location, pos)
    return resultLight
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
   * @returns {Sprite}
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

  static stringToColor(value: string): number {
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

      return 0 //Phaser.Display.Color.GetColor32(r, g, b, a)

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
