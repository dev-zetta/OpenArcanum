//@flow
import Lance from '../libs/Lance'
import GameMap from './map/GameMap'
import type AGateEngine from '../AGate';

export default class GameEngine extends Lance.GameEngine {
  map: GameMap

  /**
   *
   */
  constructor(core: AGateEngine, options: Object) {
    super(options)
    this.core = core

    this.map = new GameMap(this)
    this.assetLoader = core.assetLoader
    this.events = core.eventEmitter
    this.database = core.database

    this.physicsEngine = new Lance.SimplePhysicsEngine({
      gameEngine: this,
      collisions: {
        type: `brute`
      }
    })

    this.events.on('scene.created', this.load, this)
  }

  initWorld() {
    super.initWorld({
      worldWrap: true,
      width: 3000,
      height: 3000
    })
  }

  /**
   *
   * @param serializer
   */
  registerClasses(serializer: Object) {
    //serializer.registerClass(Ship);
    //serializer.registerClass(Missile);
  }

  /**
   *
   * @param isReenact
   * @param t
   * @param dt
   * @param physicsOnly
   */
  step(isReenact: boolean, t: number, dt: number, physicsOnly: boolean) {
    super.step(isReenact, t, dt, physicsOnly)
    this.map.update().then(() => {

    })
  }

  /**
   *
   */
  load() {
    let path = this.core.getDataPath(`Bates Mansion Lev 2`)
    this.map.load(path)
  }

  /**
   *
   */
  onPreloaded() {
    //this.load()
  }

  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {
    this.core.client.onMapLoading(map)
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {
    this.core.client.onMapLoaded(map)
  }

  processInput(inputData: Object, playerId: number, isServer: boolean) {
    super.processInput(inputData, playerId)

    lll(`input`, inputData, playerId)
    /*let playerShip = this.world.queryObject({
      playerId: playerId,
      instanceType: Ship
    });*/

    this.emit(`fireMissile`)
  }
}
