//@flow
import GameNetwork from './GameNetwork'
import GameMap from './map/GameMap'
import type AGateEngine from '../AGate'

import * as PlayerLogic from './logic/player'
import type AssetLoader from './assets/AssetLoader'
import type EventEmitter from './misc/EventEmitter'
import type Database from './realm/Database'
import SimplePhysicsEngine from './physics/SimplePhysicsEngine';

export default class GameEngine extends GameNetwork {

  map: GameMap
  assetLoader: AssetLoader
  events: EventEmitter
  database: Database
  commandEvaluators: Map<string, Object>

  /**
   *
   */
  constructor(core: AGateEngine, options: Object) {
    super(options)
    this.core = core

    this.assetLoader = core.assetLoader
    this.events = core.eventEmitter
    this.database = core.database
    this.map = new GameMap(this)
    this.commandEvaluators = new Map()

    this.physicsEngine = new SimplePhysicsEngine({
      gameEngine: this,
      collisions: {
        type: `brute`
      }
    })

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)

    //this.events.on(`player.command`, this.onPlayerCommand, this)

    this.addCommandEvaluators(`Player`, PlayerLogic)
  }

  /**
   *
   * @param namespace
   * @returns {*}
   */
  getConfig(namespace: string): Object {
    return AGate.config[namespace]
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
      instances.set(name, new classType({engine: this}))
    }

    this.commandEvaluators.set(name, instances)
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
   * @param map
   */
  onMapLoading(map: GameMap) {}

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {}

  /**
   *
   * @param path
   * @param command
   */
  sendCommand(path: string | Array, command: Object) {
    lll(`Sending command`, path, command)

    path = path.split(`:`)
    let source = path[0]
    let name = path[1]

    let evaluators = this.commandEvaluators.get(source)

    let evaluator = evaluators.get(name)

    console.log(`command`, command)
    let result = evaluator.onCommand(command)

    this.events.emit(`${source}.Command`, {
      type: name,
      command
    })
  }

  onPlayerCommand({player: Entity, type: string}: Object) {}

  /* LANCE */

  initWorld() {
    super.initWorld({
      worldWrap: true,
      width: 3000,
      height: 3000
    })
  }

  /**
   * Add object to the game world. On the client side, the object may not be created,
   * if the server copy of this object is already in the game world. This could happen
   * when the client is using delayed-input, and the RTT is very low.
   * @param object
   */
  addObjectToWorld(object: Object): Object {
    return super.addObjectToWorld(object)
  }

  /**
   * Register Game Object Classes
   * @param serializer
   */
  registerClasses(serializer: Object) {
    //serializer.registerClass(Ship);
    //serializer.registerClass(Missile);
  }

  /**
   * Start the game. This method runs on both server and client. Extending the
   * start method is useful for setting up the game's worldSettings attribute,
   * and registering methods on the event handler.
   */
  start() {
    super.start()
  }

  /**
   * Single game step.
   * @param isReenact
   * @param time
   * @param delta
   * @param physicsOnly
   */
  step(isReenact: boolean, time: number, delta: number, physicsOnly: boolean) {
    super.step(isReenact, time, delta, physicsOnly)
    this.map.update({time, delta}).then(() => {})
  }

  /**
   * Override this function to implement input handling. This method will be called
   * on the specific client where the input was received, and will also be called on the server
   * when the input reaches the server. The client does not call this method directly,
   * rather the client calls ClientEngine#sendInput so that the input is sent to both server and client,
   * and so that the input is delayed artificially if so configured.
   *
   The input is described by a short string, and is given an index. The index is used
   internally to keep track of inputs which have already been applied on the client
   during synchronization. The input is also associated with the ID of a player.
   * @param inputData
   * @param playerId
   * @param isServer
   */
  processInput(inputData: Object, playerId: number, isServer: boolean) {
    lll(`input`, inputData, playerId, isServer)
    super.processInput(inputData, playerId, isServer)



    /*// get the player ship tied to the player socket
    let playerShip = this.world.queryObject({
      playerId: playerId,
      instanceType: Ship
    });

    if (playerShip) {
      if (inputData.input == 'up') {
        playerShip.accelerate(0.05);
        playerShip.showThrust = 5; // show thrust for next steps.
      } else if (inputData.input == 'right') {
        playerShip.turnRight(2.5);
      } else if (inputData.input == 'left') {
        playerShip.turnLeft(2.5);
      } else if (inputData.input == 'space') {
        this.makeMissile(playerShip, inputData.messageIndex);
        this.emit('fireMissile');
      }
    }*/

    //this.emit(`fireMissile`)
  }

  /**
   * A synchronization update arrived from the server
   * @param sync
   */
  syncReceived(sync: Object) {
    super.syncReceived(sync)

  }
}
