// @flow

import ClientNetwork from './network/ClientNetwork'
import Scene from './Scene'
import World from './World'
import Location from '../shared/Location'
import Manager from './Gui'
import Renderer from './Renderer'
import Utils from './Utils'
import EntityUtils from '../shared/entity/Utils'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'
import type AssetLoader from '../shared/assets/AssetLoader';
import type EventEmitter from '../shared/misc/EventEmitter';
import GfxPathBuilder from '../shared/assets/GfxPathBuilder';
import Player from '../shared/player/Player'
import StepState from '../shared/StepState';
import * as PlayerLogic from './logic/player'

export default class ClientEngine extends ClientNetwork {
  renderer: Renderer
  scene: Scene
  guiManager: Manager
  player: Player
  commandEvaluators: Map<string, Object>

  /**
   *
   * @param gameEngine
   * @param options
   * @param canvas
   */
  constructor(gameEngine: GameEngine, options: Object) {
    options = Object.assign(
      {
        autoConnect: false
      },
      options
    )

    super(gameEngine, options)
    this.guiManager = new Manager(gameEngine)
    this.player = null
    this.ready = false
    this.runtimeError = null

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.events.on(`Scene:Created`, this.onSceneCreated, this)
    this.events.on(`Object:Click`, this.onObjectClick, this)
    this.events.on(`Object:Updated`, this.onObjectUpdated, this)
    this.events.on('Game:Start', this.onStartGame, this)

    this.commandEvaluators = new Map()

    //this.events.on(`player.command`, this.onPlayerCommand, this)

    this.addCommandEvaluators(`Player`, PlayerLogic)

  }

  async startOffline(mapId: string) {
    if (!mapId) throw new Error('Offline startup requires a converted map ID')
    this.world = new World(this.gameEngine, { id: 'offline' })
    this.gameEngine.world = this.world
    await this.world.init()
    this.map = await this.world.loadMap(mapId)
    await this.scene.mapReady
    const location = this.map.getStartLocation()
    if (this.map.isTileBlocked(location)) throw new Error('Converted map start tile is blocked')
    this.player = await this.world.addPlayer(location)
    await this.scene.addEntity(this.player, this.map.objectGroup)
    this.scene.sortGroup(this.map.objectGroup)
    this.scene.setCameraLocation(location)
    await this.world.start()
    this.ready = true
    await this.start()
    this.events.emit('Player:Joined', this.player)
    return this
  }

  onRuntimeError(error: Error) {
    this.runtimeError = error.message
    this.ready = false
    if (this.movement) {
      this.movement.reject(error)
      this.movement = null
    }
    this.events.emit('Game:Error', error)
    console.error(error)
  }

  stop() {
    this.stopped = true
    this.ready = false
    if (this.scene) this.scene.stop()
    if (this.movement) {
      this.movement.reject(new Error('Client stopped during movement'))
      this.movement = null
    }
  }

  getDevelopmentState() {
    const map = this.map
    const sectors = map ? map.getActiveSectors() : []
    let tiles = 0, renderedTiles = 0, roofs = 0, roofRows = 0, lights = 0, renderedEntities = 0
    for (const sector of sectors) {
      sector.inspectTiles(tile => {
        if (tile && tile.type) tiles++
        if (tile && tile.sprite && tile.sprite.iso.parent) renderedTiles++
      })
      roofRows += sector.roofs ? sector.roofs.length : 0
      roofs += sector.roofs ? sector.roofs.flat().filter(roof => roof != null).length : 0
      lights += sector.lights ? sector.lights.length : 0
    }
    const duplicateSourceIds = []
    if (this.world) {
      for (const entity of this.world.entityManager.entities.values()) {
        const visual = entity.visual && entity.visual.classes.current
        if (visual && visual.sprite && visual.sprite.iso.parent) renderedEntities++
        if (entity.sourceId) duplicateSourceIds.push(entity.sourceId)
      }
    }
    const sprite = this.player && this.player.visual.classes.current.sprite
    const center = this.scene && this.scene.renderer.viewport.center
    return {
      ready: this.ready, running: this.ready && !this.scene.stopped,
      frameCount: this.scene ? this.scene.frameCount : 0,
      error: this.runtimeError || (this.scene && this.scene.error),
      map: map ? { id: map.id, width: map.width, height: map.height } : null,
      sectors: sectors.length, tiles, renderedTiles,
      entities: this.world ? this.world.entityManager.entities.size : 0,
      prototypes: this.world ? this.world.entityManager.prototypes.size : 0,
      renderedEntities, duplicateSourceIds, roofs, roofRows, lights,
      player: this.player ? { id: this.player.id, type: this.player.base.type,
        location: Location.transformToRaw(this.player.base.location),
        spritePosition: sprite ? [sprite.iso.x, sprite.iso.y] : null,
        rendered: !!(sprite && sprite.iso.parent), moving: !!this.movement } : null,
      camera: center ? [center.x, center.y] : null,
      unsupported: ['campaign', 'NPC AI', 'combat', 'dialogue', 'quests', 'inventory rules',
        'party', 'magic', 'save/load', 'network play', 'roof rendering', 'lighting']
    }
  }

  async movePlayerTo(destination: Location | Array<number>): Promise<Object> {
    if (!this.ready || this.options.standaloneMode !== true) throw new Error('Offline player is not ready')
    if (this.movement || this.preparingMovement) throw new Error('Player is already moving')
    const target = new Location(Location.transformToRaw(destination))
    const start = new Location(Location.transformToRaw(this.player.base.location))
    if (start.equals(target)) return { path: [Location.transformToRaw(start)] }
    const path = this.map.pathFind.findPath(start, target)
    if (!path.length) throw new Error(`No walkable path to ${target.x},${target.y}`)
    if (path.length === 1) return { path: path.map(p => Location.transformToRaw(p)) }
    this.preparingMovement = true
    try {
      const visual = this.player.visual.classes.current
      const direction = String(Location.velocityToDirection(Location.calculateVelocity(path[0], path[1])))
      visual.animation = 'Walk'
      visual.stage = direction
      await visual.sprite.change(visual)
      if (!this.ready || this.stopped) throw new Error('Client stopped during movement preparation')
      return await new Promise((resolve, reject) => {
        this.movement = { path, index: 1, elapsed: 0, resolve, reject }
      })
    } finally {
      this.preparingMovement = false
    }
  }

  advancePlayerMovement(dt: number) {
    const movement = this.movement
    if (!movement) return
    movement.elapsed += Math.max(0, dt)
    const sprite = this.player.visual.classes.current.sprite
    while (movement.elapsed >= 1000 && movement.index < movement.path.length) {
      const previous = movement.path[movement.index - 1]
      const next = movement.path[movement.index]
      this.map.moveEntity(this.player, previous, next)
      this.player.base.location.set([next.x, next.y])
      movement.index++
      movement.elapsed -= 1000
    }
    if (movement.index >= movement.path.length) {
      const last = movement.path.length - 1
      sprite.stage = String(Location.velocityToDirection(
        Location.calculateVelocity(movement.path[last - 1], movement.path[last])))
      sprite.setPosition(this.player.base.location.x * 40, this.player.base.location.y * 40)
      this.movement = null
      const visual = this.player.visual.classes.current
      visual.animation = 'Stand'
      sprite.change(visual).then(() => movement.resolve({ path: movement.path.map(p => Location.transformToRaw(p)) }),
        error => { movement.reject(error); this.onRuntimeError(error) })
      return
    }
    const previous = movement.path[movement.index - 1]
    const next = movement.path[movement.index]
    const fraction = movement.elapsed / 1000
    sprite.stage = String(Location.velocityToDirection(Location.calculateVelocity(previous, next)))
    sprite.setFrame(sprite.frame)
    sprite.setPosition((previous.x + (next.x - previous.x) * fraction) * 40,
      (previous.y + (next.y - previous.y) * fraction) * 40)
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
   * @returns {{width: number, height: number}}
   */
  getWindowRect(): Object {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async create(canvas: HTMLCanvasElement) {
    lll('Client: Creating gameEngine')


    this.scene = new Scene(this)
    await this.scene.create(canvas)
    await this.guiManager.loadAssets()

    /*this.listenUI(`window.resize`, () => {
      let rect = this.getWindowRect()

      //this.physics.world.setBounds(x, y, width, height, true, true, true, true);
      //this.scene.resizeViewport(rect.width, rect.height)
    })*/

    this.listenUI('startGameBtn:click', () => {
      this.events.emit('Game:Start')
    })

    //this.events.on(`objectAdded`, this.onObjectAdded.bind(this))
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async onStartGame() {
    if (this.options.standaloneMode === true) return
    await this.start()
    await this.connect()
  }

  /**
   *
   */
  updateEntities() {
    let entities = this.world.getDynamicEntities()

    for (let [id, entity] of entities) {
      this.updateEntity(entity)
    }
  }

  /**
   *
   * @param entity
   */
  updateEntity(entity: Entity) {
    this.guiManager.updateEntityBubble(entity)
  }

  /**
   *
   * @param state
   */
  step(state: StepState, dt: number) {
    if (this.options.standaloneMode === true) {
      if (!this.ready || !this.world) return
      this.advancePlayerMovement(dt)
      this.world.entityManager.update(state, dt)
      this.world.stepCount++
      this.updateEntities()
      return
    }
    if (!this.world) {
      return
    }

    super.step(state)
    this.updateEntities()
  }

  /**
   *
   */
  async start() {
    lll('Client: Starting')

    await this.scene.start()

    await super.start()
    //await this.connect()

    this.events.emit(`Client:Started`, `default`)

    //this.gameEngine.once('renderer.ready', () => {
    //  Game input
    /*if (Utils.isTouchDevice()){
        this.controls = new MobileControls(this.renderer);
      } else {*/
    //this.controls = new Lance.KeyboardControls(this)
    //}

    //play sound when user fire missle
    // this.events.on(`fireMissile`, () => {
    //   lll(`fireM`)
    //
    //   if (this.renderer.scene) {
    //     //this.renderer.scene.soundFX_lasergun.play();
    //   }
    //})
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async connect(options: Object = {}) {
    lll('Client: Joining server')
    const config = this.gameEngine.getConfig(`client`)
    this.options.serverURL = config.serverURL
    await super.connect(options)

    await this.joinServer({ login: { user: 'test', password: 'test' } })
  }


  /**
   * Disconnect from game server
   * @returns {*}
   */
  disconnect() {
    return super.disconnect()
  }


  /**
   *
   * @param scene
   */
  onSceneCreated(scene: Scene) {
    this.events.emit(`Client:Created`, this)
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


  }

  /**
   *
   * @param entity
   */
  onObjectAdded(entity) {
    this.guiManager.addEntityBubble(entity)
  }

  /**
   *
   * @param entity
   */
  onObjectUpdated(entity) {

  }

  /**
   *
   * @param gameObject
   */
  onObjectClick(gameObject: Object) {
    if (!gameObject) return
    if (this.options.standaloneMode === true) {
      if (gameObject.data && gameObject.data.type === 'Tile') {
        this.movePlayerTo(gameObject.data.location).catch(error => {
          this.events.emit('Player:MovementRejected', error.message)
          console.warn(error.message)
        })
      }
      return
    }
    lll(gameObject)
    if (gameObject.data) {
      let data = gameObject.data

      const isObject = Utils.isUndefined(data.type)
      if (isObject) {
        this.sendCommand(`Player:EntitySelect`, { entity: data })
      } else {
        this.sendCommand(`Player:TileSelect`, { tile: data })
      }

      if (data.type !== `Tile`) {
        this.guiManager.addDatGui(data)
      }
    } else {
      this.guiManager.addDatGui(gameObject)
    }
  }

  /**
   *
   * @param map
   * @param location
   * @returns {Promise<void>}
   */
  async addPlayer(location: Location) {
    let player = await this.world.addPlayer(location)
    this.player = player

    this.events.emit(`Player:Joined`, player)
  }

  /**
   *
   * @param path
   * @param command
   */
  sendCommand(path: string | Array, command: Object) {
    lll(`Client: Sending command`, path, command)

    let result = this.evaluateCommand(path, command)
    let {source, name, action, data} = result

    if (action) {
      this.sendRequest(action, data)
    }


    this.events.emit(`${source}.Command`, {
      type: name,
      command
    })
  }

  /**
   *
   * @param name
   * @param logics
   */
  addCommandEvaluators(name: string, logics: Object) {
    let instances = new Map()
    for (let name in logics) {
      let classType = logics[name]
      instances.set(name, new classType({ engine: this }))
    }

    this.commandEvaluators.set(name, instances)
  }

  /**
   *
   * @param path
   * @param command
   * @returns {{source: string, name: string, action: *, data: *}}
   */
  evaluateCommand(path: Array|string, command: Object) {
    if (Utils.isString(path)) {
      path = path.split(`:`)
    }

    let source = path[0]
    let name = path[1]

    let evaluators = this.commandEvaluators.get(source)

    let evaluator = evaluators.get(name)

    let result = evaluator.onCommand(command)

    lle(`command`, { command, result })
    return {source, name, action: result.action, data: result.data}
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
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenUI(name: string, listener: any, context) {
    return this.events.on(`ui.${name}`, listener, context)
  }

  /**
   *
   * @param name
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenOnceUI(name: string, listener: any, context) {
    return this.events.once(`ui.${name}`, listener, context)
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
   * @param target
   * @returns {Promise<Object>}
   */
  async loadAsset(
    key: string,
    type: string,
    options: Object,
    target: ?Object
  ): Promise<Object> {


    let descriptor = this.assetLoader.getCachedAsset(key)
    if (descriptor) {
      return descriptor
    }

    descriptor = Utils.merge(options, { key, type })

    let loaded = await this.assetLoader.loadAsset(descriptor, target)
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

  /**
   *
   * @param art
   */
  getGfxPath(art) {
    return GfxPathBuilder.build(art)
  }

}
