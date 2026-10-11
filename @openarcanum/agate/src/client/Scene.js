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
const ShaderTest2: string = `test`

export default class Scene {
  customLoader: boolean
  events: EventEmitter
  gameEngine: GameEngine
  client: ClientEngine
  assetLoader: AssetLoader
  renderer: Renderer
  sectors: Map<String, Object>
  canvas: HTMLCanvasElement

  stats: Object
  stopped: boolean

  pixi: PIXI.Application
  camera: Camera

  isometric: Isometric


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
    this.sectors = new Map()
    this.stopped = true
    this.frameCount = 0
    this.error = null

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    // this.gameEngine.events.on(`client.started`, super.start, this)

    this.events.on(`Sector:Loading`, this.onSectorLoading, this)
    this.events.on(`Sector:Loaded`, this.onSectorLoaded, this)

    //this.events.on('Map:NewEntity', this.onNewEntity, this)
    this.events.on('World:NewEntity', this.onNewDynamicEntity, this)

    //this.events.on('Player:Joined', this.onPlayerJoined, this)
    this.events.on(`Object:Click`, this.onObjectClick, this)
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
    }*/

    this.renderer.update(time, delta)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.stopped) return
    this.stopped = false
    this.stats = {
      lastFrameTime: null,
      lastUpdateTime: null
    }

    await this.renderer.start()

    const frameRate = 30
    const timePerFrame = 1000 / frameRate
   // lle(timePerFrame)

    let renderLoop = (timestamp) => {
      if (this.stopped) {
        this.renderer.stop()
        return
      }

      this.frameRequest = global.requestAnimationFrame(renderLoop)

      // Start a fresh clock after startup/resume; asset-loading or paused time
      // must not be counted as movement on the first frame.
      if (this.stats.lastFrameTime === null) {
        this.stats.lastFrameTime = timestamp
        this.stats.lastUpdateTime = timestamp
      }
      const elapsed = timestamp - this.stats.lastFrameTime

      if (elapsed >= timePerFrame) {
        try {
          this.update(timestamp, timestamp - this.stats.lastUpdateTime)
          this.stats.lastUpdateTime = timestamp
          this.frameCount++
        } catch (error) {
          this.error = error.message
          this.stop()
          this.client.onRuntimeError(error)
          return
        }
        this.stats.lastFrameTime = timestamp - (elapsed % timePerFrame)
      }
    }

    this.frameRequest = global.requestAnimationFrame(renderLoop)
  }

  stop() {
    this.stopped = true
    if (this.frameRequest) global.cancelAnimationFrame(this.frameRequest)
    this.renderer.stop()
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
    this.canvas = canvas

    // let contextCreationConfig = {
    //   alpha: false,
    //   depth: true,
    //   antialias: true,
    //   premultipliedAlpha: true,
    //   stencil: true,
    //   preserveDrawingBuffer: false,
    //   failIfMajorPerformanceCaveat: false,
    //   powerPreference: `default`
    // }
    //
    // let myCustomContext = canvas.getContext(`webgl2`, contextCreationConfig)

    this.pixi = new PIXI.Application()
    await this.pixi.init({
      ...this.client.getWindowRect(),
      autoStart: false,
      canvas,
      backgroundAlpha: 0,
      preference: 'webgl',
      resolution: window.devicePixelRatio || 1,
      resizeTo: window
    })

    this.pixi.ticker.stop()

    // create the renderer
    this.renderer = new Renderer(this.client)
    await this.renderer.init()

    this.camera = new Camera(this.renderer.viewport)

    let stage = this.renderer.stage
    stage.eventMode = 'static'

    this.resizeViewport(this.pixi.screen.width, this.pixi.screen.height)
    this.pixi.renderer.on('resize', (width, height) => {
      this.resizeViewport(width, height)
    })

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
    //this.setCameraShader('gamma')
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

    this.mapReady = this.addMap(map)
  }

  /**
   *
   * @param sector
   * @returns {Promise<void>}
   */
  onSectorLoading(sector: Sector) {

  }

  /**
   *
   * @param sector
   * @returns {Promise<void>}
   */
  onSectorLoaded(sector: Sector) {
    // Atlas readiness is awaited by addSector, rather than fire-and-forget
    // EventEmitter callbacks while the world is still loading.
  }

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

      for (let className: string of ['current']) {
        if (className.charAt(0) === '_') { // TODO: Hack. Use function to check if prop is private
          continue
        }


        let visualClass = visualClasses[className] || visualClasses.normal
        if (!visualClass) continue
        if (visualClass.sprite) continue

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
    // Selection must not mutate the source art with the old debug tint.

    //gameObject.setPipeline(ShaderTest)
  }

  /**
   *
   * @param player
   * @param map
   * @returns {Promise<void>}
   */
  async onNewDynamicEntity(entity) {
    await this.onNewEntity(entity)

    // const {location} = entity.base
    // const sector = entity.world.getSector(location.sectorX, location.sectorY)
    //
    // const resources = this.getSectorResources(sector.id)

    this.addEntity(entity, this.renderer.stage)

    //this.sortGroup(map.rootGroup)
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

  /**
   *
   * @param width
   * @param height
   */
  resizeViewport(width: number, height: number) {
    this.renderer.viewport.resize(width, height)
  }

  /**
   *
   * @param name
   */
  setCameraShader(name: string) {
    let shader = this.renderer.getShader(name)
    if (!shader) {
      return false
    }

    //pipeline.setFloat1('brightPassThreshold', 0.1)

    this.renderer.bindShader(shader)
  }

  /**
   *
   * @param tiles
   */
  highlightTiles(tiles: Array<Object>) {
return
    let color = Math.random() * 0xFFFFFF


    for (let location of tiles) {
      let tile = this.client.world.getTile(
        location.y,
        location.x
      )

      if (!tile || !tile.sprite) {
        continue
      }

      tile.sprite.setTint(color)
    }
  }

  /**
   *
   * @param parent
   * @returns {Container}
   */
  newGroup(parent) {
    if (!parent) {
      parent = this.renderer.stage
    }

    let container = new PIXI.Container()
    container.sortableChildren = true
    //container.interactive = true
    parent.addChild(container)

    return container
  }

  /**
   *
   * @param group
   */
  sortGroup(group) {
    group.sortChildren()
  }

  /**
   *
   * @param map
   * @param target
   */
  async addMap(map: GameMap /*, target: Object = this*/) {
    lll(`Placing to scene: ${map.path}`)

    let rootGroup = this.newGroup()
    map.rootGroup = rootGroup
    map.tileGroup = this.newGroup(rootGroup)
    map.objectGroup = this.newGroup(rootGroup)

    let sectors = map.getActiveSectors()

    let sortGroups = []
    for (let sector of sectors) {
      await this.addSector(sector, map.tileGroup, map.objectGroup)
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

    // map.rootGroup = rootGroup
  }

  /**
   *
   * @param sector
   * @param resources
   */
  setSectorResource(sector: Sector, resources: Object) {
    this.sectors.set(sector.id, resources)
  }

  /**
   *
   * @param id
   * @returns {Object}
   */
  getSectorResources(id: string): Object {
    return this.sectors.get(id)
  }

  /**
   *
   * @param sector
   * @param target
   */
  async addSector(sector: Sector, target: Object, objectGroup: Object) {
    if (!sector.tiles) {
      lll(`Invalid sector`)
      return
    }

    // Add tiles
    const tileGroup = this.newGroup(target)

    let ax = sector.x * Sector.Width * Sector.TileHeight
    let ay = sector.y * Sector.Height * Sector.TileHeight

    let offset = new Vec2(0, 20)
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
          tile.sprite = new Sprite(this)
          await tile.sprite.load(tile)
          this.addSprite(tile.sprite, tileGroup,
            tile.location.x * Sector.TileWidthHalf,
            tile.location.y * Sector.TileWidthHalf, 0, offset)
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
    const staticGroup = objectGroup || this.newGroup(target)
    //target.add(this.staticGroup);

    await Promise.all(Array.from(sector.entities.values(), entity => this.addEntity(entity, staticGroup)))

    // Sort objects
    //target.scene.sortGroup(this.staticGroup);

    this.sortGroup(staticGroup)

    this.setSectorResource(sector, {
      tileGroup,
      staticGroup,
    })
  }

  /**
   *
   * @param entity
   * @param target
   */
  async addEntity(entity: Entity, target: Object) {
    // Inventory objects carry the owner's world location. They are retained in
    // the ECS, but their ground graphics must not be displayed on the floor.
    if (entity.base.flags.hasAny(['Inventory', 'Off', 'Destroyed'])) return
    await this.onNewEntity(entity)

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

    if (this.client.options.standaloneMode !== true &&
        (sprite.type === Gfx.Types.Critter || sprite.type === Gfx.Types.UniqueNpc)) {
      let shader = this.renderer.getShader('GlowFilter')
      if (shader) {
       // shader.uniforms.thickness = 4
        // shader.uniforms.shadowDirection = [0.4, 0.5];
        // shader.uniforms.floorY = 129
         shader.padding = 50
      }

      sprite.setFilter(shader)
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
      lle(`wrong light`)
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
