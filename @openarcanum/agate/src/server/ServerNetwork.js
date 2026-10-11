// @flow

import fs from 'fs'
import NetworkUtils from '../shared/misc/NetworkUtils'
import Utils from '../shared/misc/Utils'
import Scheduler from '../shared/misc/Scheduler'
import Serializer from '../shared/serialize/Serializer'
import NetworkTransmitter from '../shared/network/NetworkTransmitter'
import NetworkMonitor from '../shared/network/NetworkMonitor'
import type Trace from '../shared/misc/Trace';
import GameWorld from './World';
import type GameEngine from '../shared/GameEngine';
import type GameMap from '../shared/map/GameMap';
import Socket from './Socket'
import Timer from '../shared/misc/Timer';

import type EventEmitter from '../shared/misc/EventEmitter';
import type StepState from '../shared/StepState';
import Player from './Player';

/**
 * ServerEngine is the main server-side singleton code.
 * Extend this class with your own server-side logic, and
 * start a single instance.
 *
 * This class should not be used to contain the actual
 * game logic.  That belongs in the GameEngine class, where the mechanics
 * of the gameplay are actually implemented.
 * The ServerEngine singleton is typically a lightweight
 * implementation, logging gameplay statistics and registering
 * user activity and user data.
 *
 * The base class implementation is responsible for starting
 * the server, initiating each game step, accepting new
 * connections and dis-connections, emitting periodic game-state
 * updates, and capturing remote user inputs.
 */
export default class ServerNetwork {
  socket: Socket
  serializer: Serializer
  networkTransmitter: NetworkTransmitter
  networkMonitor: NetworkMonitor
  scheduler: Scheduler

  gameEngine: GameEngine
  options: Object

  connectedPlayers: Object
  playerInputQueues: Object
  objMemory: Object
  serverTime: number

  worlds: Map<string, GameWorld>


  /**
   * create a ServerEngine instance
   *
   * @param {SocketIO} io - the SocketIO server
   * @param {GameEngine} gameEngine - instance of GameEngine
   * @param {Object} options - server options
   * @param {Number} options.stepRate - number of steps per second
   * @param {Number} options.updateRate - number of steps in each update (sync)
   * @param {Number} options.fullSyncRate - rate at which full-syncs are sent, in step count
   * @param {String} options.tracesPath - path where traces should go
   * @param {Boolean} options.countConnections - should ping player connections to lance.gg
   * @param {Boolean} options.updateOnObjectCreation - should send update immediately when new object is created
   * @param {Number} options.timeoutInterval=180 - number of seconds after which a player is automatically disconnected if no input is received. Set to 0 for no timeout
   * @return {ServerEngine} serverEngine - self
   */
  constructor(gameEngine: GameEngine, options: Object) {
    this.options = Object.assign(
      {
        updateRate: 6,
        stepRate: 60,
        fullSyncRate: 20,
        timeoutInterval: 180,
        updateOnObjectCreation: true,
        tracesPath: ``,
        countConnections: true,
        debug: {
          serverSendLag: false
        }
      },
      options
    )

    let socket = new Socket()
    socket.attach(options.listenPort)
    lle(`Listening on ${options.listenPort}`)


    if (this.options.tracesPath !== ``) {
      this.options.tracesPath += `/`
      //mkdirp.sync(this.options.tracesPath)
    }

    this.socket = socket

    /**
     * reference to game engine
     * @member {GameEngine}
     */
    this.serializer = new Serializer()
    this.gameEngine = gameEngine
    this.gameEngine.registerClasses(this.serializer)
    this.networkTransmitter = new NetworkTransmitter(this.serializer)
    //this.networkMonitor = new NetworkMonitor(this)

    this.connectedPlayers = {}
    this.playerInputQueues = {}
    this.objMemory = {}

    this.socket.on(`connection`, this.onConnection.bind(this))

    this.events.on(`objectAdded`, this.onObjectAdded, this)
    this.events.on(
      `objectDestroyed`,
      this.onObjectDestroyed, this
    )

    this.worlds = new Map()
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
   * @returns {Trace}
   */
  get trace(): Trace {
    return this.gameEngine.trace
  }

  /**
   *
   * @param socket
   * @param name
   */
  bindPlayerEvent(player: Player, name: string) {
    lle('Server: bindSocketEvent - ' + name)
    try {
      const methodName = 'on' + Utils.upperFirst(name)
      const method = this[methodName].bind(this)
      socket.on(name, data => {
        lll('Server: ' + name)
        method(player, data)
      })
    } catch (e) {
      lle(e)
    }

  }

  /**
   *
   * @param socket
   * @param name
   * @param payload
   */
  emitSocketEvent(socket: Socket, name: string, payload: Object) {
    lle('Server: emit ' + name)
    socket.emit(name, payload)
  }

  /**
   *
   * @param id
   * @returns {GameWorld<>}
   */
  getWorld(id: string): ?GameWorld {
    return this.worlds.get(id)
  }


  /**
   *
   * @returns {Promise<void>}
   */
  async createWorld(options: Object = {}): Promise<GameWorld> {
    options = {
      ...options
    }

    const world = new GameWorld(this.gameEngine, options)
    this.worlds.set(world.id, world)

    await world.init()

    return world
  }

  /**
   *
   */
  async start() {
    lle('Server start')

    this.trace.info(() => `========== game engine started ==========`)
    // create the default timer
    this.timer = new Timer()
    this.timer.play()
    this.events.on(`postStep`, (step, isReenact) => {

    })

    this.events.emit(`start`, {timestamp: Utils.getCurrentTimestamp()})

    this.events.emit(`server__init`)

    let schedulerConfig = {
      tick: this.step.bind(this),
      period: 1000 / this.options.stepRate,
      delay: 4
    }
    this.scheduler = new Scheduler(schedulerConfig).start()

    const options = {
      id: 'default'
    }

    await this.createWorld(options)
  }

  /**
   *
   */
  step(state: StepState) {
    // skip physics for shadow objects during re-enactment
    function objectFilter(o) {
      return !state.isReenact || o.id < clientIDSpace
    }

    // physics-only step
    if (this.physicsEngine && state.physicsOnly) {
      //if (dt) dt /= 1000 // physics engines work in seconds
      this.physicsEngine.step(state.elapsed / 1000, objectFilter)
      return
    }

    // physics step
    if (this.physicsEngine && !this.ignorePhysics) {
      this.physicsEngine.step(state.elapsed / 1000, objectFilter)
    }

    for (const [id, world] of this.worlds) {
      this.updateWorld(state, world)
    }

    // if (!state.isReenact) {
    //   this.timer.tick()
    // }
  }

  /**
   *
   * @param state
   * @param world
   */
  updateWorld(state: StepState, world: GameWorld, ) {

    world.stepCount++
    this.events.emit(`preStep`, {world, state})

    // first update the trace state
    this.trace.setStep(world.stepCount)
    this.events.emit(
      `server__preStep`,
      world.stepCount + 1
    )

    this.serverTime = Utils.getCurrentTimestamp()

    // for each player, replay all the inputs in the oldest step
    for (let playerId in this.playerInputQueues) {
      let inputQueue = this.playerInputQueues[playerId]
      let queueSteps = Object.keys(inputQueue)
      let minStep = Math.min.apply(null, queueSteps)

      // check that there are inputs for this step,
      // and that we have reached/passed this step
      if (queueSteps.length > 0 && minStep <= world.stepCount) {
        inputQueue[minStep].forEach(input => {
          this.events.emit(`server__processInput`, {
            input,
            playerId
          })
          this.events.emit(`processInput`, { input, playerId })
          this.gameEngine.processCommand(input, playerId)
        })
        delete inputQueue[minStep]
      }
    }

    // run the game engine step
    // this.gameEngine.step(false, this.serverTime / 1000)

    // synchronize the state to all clients
    this.syncStateToClients(world)

    // remove memory-objects which no longer exist
    for (let id in this.objMemory) {
      if (!world.getDynamicEntity(id)) {
        delete this.objMemory[id]
      }
    }

    // emit postStep event
    this.events.emit(`postStep`, {world, state})

    // step is done on the server side
    this.events.emit(
      `server__postStep`,
      world.stepCount
    )

    if (this.trace.length) {
      let traceData = this.trace.rotate()
      let traceString = ``
      traceData.forEach((t) => {
        traceString += `[${t.time.toISOString()}]${t.step}>${t.data}\n`
      })
      fs.appendFile(
        `${this.options.tracesPath}server.trace`,
        traceString,
        (err) => {
          if (err) throw err
        }
      )
    }
  }

  /**
   *
   * @param world
   */
  syncStateToClients(world: GameWorld) {
    // update clients only at the specified step interval, as defined in options
    // or if this room needs to sync

    const update = world.requestImmediateSync || world.stepCount % this.options.updateRate === 0

    if (!update) {
      return
    }

    let diffUpdate = true

    // also, one in N syncs is a full update, or a special request
    if (
      world.syncCounter++ % this.options.fullSyncRate === 0 ||
      world.requestFullSync
    ) {
      diffUpdate = false
    } else {
      // if at least one player is new, we should send a full payload
      for (const [id, player] of world.players) {
        if (player.state === `new`) {
          player.state = `synced`
          diffUpdate = false
        }
      }

    }





    for (const [id, map] of world.maps) {
      const payload = this.serializeUpdate(map, { diffUpdate })

      this.trace.info(
        () =>
          `========== sending world update ${world.stepCount} to room ${roomName} is delta update: ${diffUpdate} ==========`
      )

      for (const socketId of map.players) {
        this.connectedPlayers[socketId].socket.emit(`worldUpdate`, payload)
      }


      this.networkTransmitter.clearPayload()
      world.requestImmediateSync = false
      world.requestFullSync = false
    }
  }

  /**
   * create a serialized package of the game world
   * @param map
   * @param options
   */
  serializeUpdate(map: GameMap, options: Object) {
    // TODO: this process could be made much much faster if the buffer creation and
    //       size calculation are done in a single phase, along with string pruning.
    let diffUpdate = Boolean(options && options.diffUpdate)

    const world = map.world

    // add this sync header
    // currently this is just the sync step count
    this.networkTransmitter.addNetworkedEvent(`syncHeader`, {
      stepCount: world.stepCount,
      fullUpdate: Number(!diffUpdate)
    })

    const entities = world.getDynamicEntities()
    for (let [id, entity] in entities) {
      if (entity.map.id !== map.id) {
        continue
      }

      let prevObject = this.objMemory[id]

      // if the object (in serialized form) hasn't changed, move on
      if (diffUpdate) {
        let s = entity.serialize(this.serializer)
        if (prevObject && NetworkUtils.arrayBuffersEqual(s.dataBuffer, prevObject)) {
          continue
        }

        else {
          this.objMemory[id] = s.dataBuffer
        }

        // prune strings which haven't changed
        //obj = obj.prunedStringsClone(this.serializer, prevObject)
      }

      this.networkTransmitter.addNetworkedEvent(`objectUpdate`, {
        stepCount: world.stepCount,
        objectInstance: entity
      })
    }

    return this.networkTransmitter.serializePayload()
  }

  /**
   * Assign a player to a room
   *
   * @param player
   * @param world
   */
  assignPlayerToWorld(player: Player, world: GameWorld) {
    const worldUpdate = {
      playerId: playerId,
      //from: player.roomName,
      to: worldId
    }

    player.socket.emit(`worldUpdate`, worldUpdate)
    this.events.emit(`server__worldUpdate`, worldUpdate)
    this.trace.info(
      () =>
        `ROOM UPDATE: playerId ${player.id} from room ${world.id} to room ${worldId}`
    )

    player.worldId = world.id
    world.requestImmediateSync = true
    world.requestFullSync = true
  }

  /**
   * handle the object creation
   * @param obj
   */
  onObjectAdded(obj) {
    this.networkTransmitter.addNetworkedEvent(`objectCreate`, {
      stepCount: world.stepCount,
      objectInstance: obj
    })

    if (this.options.updateOnObjectCreation) {
      this.rooms[obj._roomName].requestImmediateSync = true
    }
  }

  /**
   * handle the object creation
   * @param obj
   */
  onObjectDestroyed(obj) {
    this.networkTransmitter.addNetworkedEvent(`objectDestroy`, {
      stepCount: world.stepCount,
      objectInstance: obj
    })
  }

  /**
   *
   * @param socket
   * @param data
   * @returns {*}
   */
  getPlayer(socket, data): Player {
    lle(socket, data)
    const { login } = data


    return playerId
  }

  /**
   *
   * @param socket
   */
  onConnection(socket: Socket) {
    lle(`Server: onConnection`, socket)

    // save player
    // this.connectedPlayers[socket.id] = {
    //   socket: socket,
    //   state: `new`
    // }

    const player = new Player(socket)

    this.bindPlayerEvent(player, `joinServer`)
    this.bindPlayerEvent(player, `disconnect`)

  }

  onDisconnect(socket: Socket) {
    lle(`Client disconnected`)
    // playerEvent.disconnectTime = Utils.getCurrentTimestamp()
    // delete this.connectedPlayers[socketId]
    //
    //
    //
    // this.events.emit(`server__playerDisconnected`, playerEvent)
    // this.events.emit(`playerDisconnected`, playerEvent)
  }

  /**
   * handle new player connection
   * @param socket
   * @param data
   */
  async onJoinServer(socket: Socket, data: Object) {
    lle(socket, data)
    let player = this.getPlayer(socket, data)


    this.assignPlayerToWorld(player, world)

    socket.playerId = player.id

    socket.lastHandledInput = null
    socket.joinTime = Utils.getCurrentTimestamp()
    this.resetIdleTimeout(socket)

    let playerEvent = {
      id: socket.id,
      playerId,
      joinTime: socket.joinTime,
      disconnectTime: 0
    }
    this.events.emit(`server__playerJoined`, playerEvent)
    this.events.emit(`playerJoined`, playerEvent)
    socket.emit(`playerJoined`, playerEvent)

    this.bindSocketEvent(socket, `request`)

    // we got a packet of trace data, write it out to a side-file
    socket.on(`trace`, (traceData) => {
      traceData = JSON.parse(traceData)
      let traceString = ``
      traceData.forEach((t) => {
        traceString += `[${t.time}]${t.step}>${t.data}\n`
      })
      fs.appendFile(
        `${this.options.tracesPath}client.${playerId}.trace`,
        traceString,
        (err) => {
          if (err) throw err
        }
      )
    })

    this.networkMonitor.registerPlayerOnServer(socket)
  }

  /**
   * handle player timeout
   * @param socket
   */
  onPlayerTimeout(socket: Socket) {
    lle(
      `Client timed out after ${this.options.timeoutInterval} seconds`,
      socket.id
    )
    socket.disconnect()
  }

  /**
   * an input has been received from a client, queue it for next step
   * @param data
   * @param socket
   */
  onRequest(data, socket) {
    if (this.connectedPlayers[socket.id]) {
      this.connectedPlayers[socket.id].socket.lastHandledInput =
        data.messageIndex
    }

    this.resetIdleTimeout(socket)

    this.queueInputForPlayer(data, socket.playerId)
  }

  /**
   * Report game status
   * This method is only relevant if the game uses MatchMaker functionality.
   * This method must return the game status.
   *
   * @return {String} Stringified game status object.
   */
  gameStatus() {
    let gameStatus = {
      numPlayers: Object.keys(this.connectedPlayers).length,
      upTime: 0,
      cpuLoad: 0,
      memoryLoad: 0,
      players: {}
    }

    for (let p of Object.keys(this.connectedPlayers)) {
      gameStatus.players[p] = {
        frameRate: 0
      }
    }

    return JSON.stringify(gameStatus)
  }


  /**
   * Override this function to implement input handling.
   * This method will be called on the specific client where the
   * input was received, and will also be called on the server
   * when the input reaches the server.  The client does not call this
   * method directly, rather the client calls {@link ClientEngine#sendInput}
   * so that the input is sent to both server and client, and so that
   * the input is delayed artificially if so configured.
   *
   * The input is described by a short string, and is given an index.
   * The index is used internally to keep track of inputs which have already been applied
   * on the client during synchronization.  The input is also associated with
   * the ID of a player.
   *
   * @param {Object} inputDesc - input descriptor object
   * @param {String} inputDesc.input - describe the input (e.g. "up", "down", "fire")
   * @param {Number} inputDesc.messageIndex - input identifier
   * @param {Number} inputDesc.step - the step on which this input occurred
   * @param {Number} playerId - the player ID
   * @param {Boolean} isServer - indicate if this function is being called on the server side
   */
  processCommand(inputData: Object, playerId: number) {
    lll(`processCommand`, { inputData, playerId })
    this.trace.info(
      () =>
        `game engine processing input[${inputDesc.messageIndex}] <${inputDesc.input}> from playerId ${playerId}`
    )
    //lle(this.world.queryObject)
    let playerEntity = this.world.queryEntity({
      id: playerId
      //instanceType: Entity
    })


    //(inputData.action, inputData.payload)
  }


  /**
   *
   * @param serverObj
   * @returns {*}
   */
  findLocalShadow(serverObj) {
    for (let localId of Object.keys(this.world.objects)) {
      if (Number(localId) < this.options.clientIDSpace) continue
      let localObj = this.world.objects[localId]
      if (
        localObj.hasOwnProperty(`inputId`) &&
        localObj.inputId === serverObj.inputId
      )
        return localObj
    }

    return null
  }



  /**
   * resets the idle timeout for a given player
   * @param socket
   */
  resetIdleTimeout(socket: Socket) {
    if (socket.idleTimeout) clearTimeout(socket.idleTimeout)
    if (this.options.timeoutInterval > 0) {
      socket.idleTimeout = setTimeout(() => {
        this.onPlayerTimeout(socket)
      }, this.options.timeoutInterval * 1000)
    }
  }

  /**
   * add an input to the input-queue for the specific player
   * each queue is key'd by step, because there may be multiple inputs
   * per step
   * @param data
   * @param playerId
   */
  queueInputForPlayer(data, playerId) {
    // create an input queue for this player, if one doesn't already exist
    if (!this.playerInputQueues.hasOwnProperty(playerId))
      this.playerInputQueues[playerId] = {}
    let queue = this.playerInputQueues[playerId]

    // create an array of inputs for this step, if one doesn't already exist
    if (!queue[data.step]) queue[data.step] = []

    // add the input to the player's queue
    queue[data.step].push(data)
  }

}

