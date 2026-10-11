// @flow

import Socket from './Socket'
import NetworkUtils from '../../shared/misc/NetworkUtils'
import Scheduler from '../../shared/misc/Scheduler'
import Synchronizer from '../synchronize/Synchronizer'
import Serializer from '../../shared/serialize/Serializer'
import NetworkMonitor from '../../shared/network/NetworkMonitor'
import NetworkTransmitter from '../../shared/network/NetworkTransmitter'
import Utils from '../../shared/misc/Utils'

import GameWorld from '../World'

import type GameEngine from '../../shared/GameEngine';
import type StepState from '../../shared/StepState';
import type EventEmitter from '../../shared/misc/EventEmitter';



// TODO: the GAME_UPS below should be common to the value implemented in the server engine,
// or better yet, it should be configurable in the GameEngine instead of ServerEngine+ClientEngine
const GAME_UPS = 60 // default number of game steps per second
const STEP_DELAY_MSEC = 12 // if forward drift detected, delay next execution by this amount
const STEP_HURRY_MSEC = 8 // if backward drift detected, hurry next execution by this amount

/**
 * The client engine is the singleton which manages the client-side
 * process, starting the game engine, listening to network messages,
 * starting client steps, and handling world updates which arrive from
 * the server.
 * Normally, a game will implement its own sub-class of ClientEngine, and may
 * override the constructor {@link ClientEngine#constructor} and the methods
 * {@link ClientEngine#start} and {@link ClientEngine#connect}
 */

export default class ClientNetwork {
  world: ?GameWorld
  gameEngine: GameEngine
  networkTransmitter: NetworkTransmitter
  networkMonitor: NetworkMonitor
  serializer: Serializer
  synchronizer: Synchronizer
  scheduler: ?Scheduler
  lastStepTime: number
  highestServerStep: number
  correction: number

  inboundMessages: Array<Object>
  delayedInputs: Array<Array<Object>>

  socket: Object // IO socket from lance
  options: Object

  skipOneStep: boolean

  stopped: boolean

  /**
   * Create a client engine instance.
   *
   * @param {GameEngine} gameEngine - a game engine
   * @param {Object} options - options object
   * @param {Boolean} options.verbose - print logs to console
   * @param {Boolean} options.autoConnect - if true, the client will automatically attempt connect to server.
   * @param {Boolean} options.standaloneMode - if true, the client will never try to connect to a server
   * @param {Number} options.delayInputCount - if set, inputs will be delayed by this many steps before they are actually applied on the client.
   * @param {Number} options.healthCheckInterval - health check message interval (millisec). Default is 1000.
   * @param {Number} options.healthCheckRTTSample - health check RTT calculation sample size. Default is 10.
   * @param {String} options.scheduler - When set to "render-schedule" the game step scheduling is controlled by the renderer and step time is variable.  When set to "fixed" the game step is run independently with a fixed step time. Default is "render-schedule".
   * @param {Object} options.syncOptions - an object describing the synchronization method. If not set, will be set to extrapolate, with local object bending set to 0.0 and remote object bending set to 0.6. If the query-string parameter "sync" is defined, then that value is passed to this object's sync attribute.
   * @param {String} options.syncOptions.sync - chosen sync option, can be "interpolate", "extrapolate", or "frameSync"
   * @param {Number} options.syncOptions.localObjBending - amount (0 to 1.0) of bending towards original client position, after each sync, for local objects
   * @param {Number} options.syncOptions.remoteObjBending - amount (0 to 1.0) of bending towards original client position, after each sync, for remote objects
   * @param {String} options.serverURL - Socket server url
   * @param {Renderer} Renderer - the Renderer class constructor
   */
  constructor(gameEngine: GameEngine, options: Object) {

    this.skipOneStep = false
    this.world = null
    this.options = Object.assign(
      {
        autoConnect: false,
        healthCheckInterval: 1000,
        healthCheckRTTSample: 10,
        stepPeriod: 1000 / GAME_UPS,
        scheduler: `render-schedule`,
        serverURL: null
      },
      options
    )

    /**
     * reference to serializer
     * @member {Serializer}
     */
    this.serializer = new Serializer()

    /**
     * reference to game engine
     * @member {GameEngine}
     */
    this.gameEngine = gameEngine
    this.gameEngine.registerClasses(this.serializer)
    this.networkTransmitter = new NetworkTransmitter(this.serializer)
    this.networkMonitor = new NetworkMonitor()

    this.inboundMessages = []
    this.outboundMessages = []

    // step scheduler
    this.scheduler = null
    this.lastStepTime = 0
    this.correction = 0

    if (this.options.standaloneMode !== true) {
      this.configureSynchronization()
    }

    // create a buffer of delayed inputs (fifo)
    if (this.options.delayInputCount) {
      this.delayedInputs = []
      for (let i = 0; i < this.options.delayInputCount; i++)
        this.delayedInputs[i] = []
    }

    this.events.emit(`client__init`)

    // https://github.com/lance-gg/spaaace/blob/master/src/client/SpaaaceClientEngine.js
    // this.networkMonitor.events.on(`RTTUpdate`, (e) => {
    //
    //
    //   //this.renderer.updateHUD(e);
    // })

    //this.socket.emit('requestRestart');
  }

  /**
   *
   * @returns {EventEmitter}
   */
  get events(): EventEmitter {
    return this.gameEngine.events
  }

  // configure the Synchronizer singleton
  configureSynchronization() {
    // the reflect syncronizer is just interpolate strategy,
    // configured to show server syncs
    let syncOptions = this.options.syncOptions
    if (syncOptions.sync === `reflect`) {
      syncOptions.sync = `interpolate`
      syncOptions.reflect = true
    }

    this.synchronizer = new Synchronizer(this, syncOptions)
  }

  /**
   * Makes a connection to the game server.  Extend this method if you want to add additional
   * logic on every connection. Call the super-class connect first, and return a promise which
   * executes when the super-class promise completes.
   *
   * @param {Object} [options] additional socket.io options
   * @return {Promise} Resolved when the connection is made to the server
   */
  async connect(options: Object = {}) {
    let connectSocket = matchMakerAnswer =>
      new Promise((resolve, reject) => {

        if (matchMakerAnswer.status !== `ok`)
          reject(`matchMaker failed status: ` + matchMakerAnswer.status)

        lll(`connecting to game server ${matchMakerAnswer.serverURL}`)
        this.socket = new Socket(matchMakerAnswer.serverURL, options)

        //this.networkMonitor.registerClient(this)

        this.socket.once(`connect`, () => {
          lle('connected')
          resolve()
        })

        //lle(this.options, this.socket)

        this.socket.once(`error`, error => {
          lle(error)
          reject(error)
        })

        this.socket.on(`disconnect`, () => {
          lle(`disconnected by server...`)
          if (!this.stopped) {
            this.stopped = true
            //reject()
          }
        })
      })

    let matchmaker = null
    if (this.options.matchmaker) {
      matchmaker = NetworkUtils.httpGetPromise(this.options.matchmaker)
    } else {
      matchmaker = Promise.resolve({
        serverURL: this.options.serverURL,
        status: `ok`
      })
    }

    return matchmaker.then(connectSocket)
  }

  /**
   *
   * @param name
   */
  bindSocketEvent(name: string) {
    const methodName = 'on' + Utils.upperFirst(name)
    const method = this[methodName].bind(this)
    this.socket.on(name, data => {
      lle('Server: ' + name)
      method(this.socket.wrapper, data)
    })
  }

  /**
   *
   * @param name
   * @param payload
   */
  emitSocketEvent(name: string, payload: Object) {
    lle('Client: emit ' + name)
    this.socket.emit(name, payload)
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async joinServer(data: Object) {
    lle('Client: joinServer', this.world)

    this.bindSocketEvent('playerJoined')
    this.bindSocketEvent('worldUpdate')

    this.emitSocketEvent(`joinServer`, data)
  }

  /**
   *
   * @param socket
   * @param data
   * @returns {Promise<void>}
   */
  async onPlayerJoined(socket: Socket, data: Object) {
    this.messageIndex = Number(this.player.id) * 10000
    this.world = new GameWorld(this.gameEngine, {})

    await this.world.start()

    let entities = this.world.getDynamicEntities()

    for (let [id, entity] of entities) {
      this.onObjectAdded(entity)
    }

    const map = this.world.getMap()

    let location = map.getStartLocation()

    this.addPlayer(location)


  }

  /**
   *
   * @param socket
   * @param data
   * @returns {Promise<void>}
   */
  async onWorldUpdate(socket: Socket, data: Object) {
    this.inboundMessages.push(data)
    this.events.emit(`client__worldUpdate`, data)
  }

  /**
   * Start the client engine, setting up the game loop, rendering loop and renderer.
   *
   * @return {Promise} Resolves once the Renderer has been initialized, and the game is
   * ready to connect
   */
  async start() {
    this.stopped = false

    if (this.options.scheduler === `fixed`) {
      // schedule and start the game loop
      this.scheduler = new Scheduler({
        period: this.options.stepPeriod,
        tick: this.step.bind(this),
        delay: STEP_DELAY_MSEC
      })
      this.scheduler.start()
    }

    /*if (this.options.autoConnect && this.options.standaloneMode !== true) {
      await this.connect().catch((error) => {
        this.stopped = true
        throw error
      })
    }*/
  }

  /**
   * Disconnect from game server
   */
  disconnect() {
    if (!this.stopped) {
      this.socket.disconnect()
      this.stopped = true
    }
  }

  // check if client step is too far ahead (leading) or too far
  // behing (lagging) the server step
  checkDrift(checkType) {
    if (!this.highestServerStep) { return }

    let thresholds = this.synchronizer.syncStrategy.STEP_DRIFT_THRESHOLDS
    let maxLead = thresholds[checkType].MAX_LEAD
    let maxLag = thresholds[checkType].MAX_LAG
    let clientStep = this.world.stepCount
    let serverStep = this.highestServerStep
    if (clientStep > serverStep + maxLead) {
      this.gameEngine.trace.warn(
        () =>
          `step drift ${checkType}. [${clientStep} > ${serverStep} + ${maxLead}] Client is ahead of server.  Delaying next step.`
      )
      if (this.scheduler) {this.scheduler.delayTick()}
      this.lastStepTime += STEP_DELAY_MSEC
      this.correction += STEP_DELAY_MSEC
    } else if (serverStep > clientStep + maxLag) {
      this.gameEngine.trace.warn(
        () =>
          `step drift ${checkType}. [${serverStep} > ${clientStep} + ${maxLag}] Client is behind server.  Hurrying next step.`
      )
      if (this.scheduler) {this.scheduler.hurryTick()}
      this.lastStepTime -= STEP_HURRY_MSEC
      this.correction -= STEP_HURRY_MSEC
    }
  }

  /**
   *  execute a single game step.  This is normally called by the Renderer at each draw event.
   * @param state
   */
  step(state: StepState) {
    // physics only case
    if (state.physicsOnly) {
     // this.gameEngine.step(state)
      return
    }

    // first update the trace state
    this.gameEngine.trace.setStep(this.world.stepCount + 1)

    // skip one step if requested
    if (this.skipOneStep === true) {
      this.skipOneStep = false
      return
    }

    this.events.emit(`client__preStep`)
    while (this.inboundMessages.length > 0) {
      this.handleInboundMessage(this.inboundMessages.pop())
      this.checkDrift(`onServerSync`)
    }

    // check for server/client step drift without update
    this.checkDrift(`onEveryStep`)

    // perform game engine step
    if (this.options.standaloneMode !== true) {
      this.handleOutboundInput()
    }
    this.applyDelayedInputs()
    this.gameEngine.step(state)
    this.events.emit(`client__postStep`, state)

    if (
      this.options.standaloneMode !== true &&
      this.gameEngine.trace.length &&
      this.socket
    ) {
      // socket might not have been initialized at this point
      this.socket.emit(`trace`, JSON.stringify(this.gameEngine.trace.rotate()))
    }
  }

  // apply a user input on the client side
  doRequestLocal(message) {
    // some synchronization strategies (interpolate) ignore inputs on client side
    if (this.gameEngine.ignoreInputs) {
      return
    }

    const inputEvent = {
      input: message.data,
      playerId: this.gameEngine.playerId
    }

    this.events.emit(`client__processInput`, inputEvent)
    this.events.emit(`processInput`, inputEvent)
    this.processCommand(message.data, this.player)
  }

  // apply user inputs which have been queued in order to create
  // an artificial delay
  applyDelayedInputs() {
    if (!this.delayedInputs) {
      return
    }
    let that = this
    let delayed = this.delayedInputs.shift()
    if (delayed && delayed.length) {
      delayed.forEach(that.doRequestLocal.bind(that))
    }
    this.delayedInputs.push([])
  }

  /**
   * This function should be called by the client whenever a user input
   * occurs.  This function will emit the input event,
   * forward the input to the client's game engine (with a delay if
   * so configured) and will transmit the input to the server as well.
   *
   * This function can be called by the extended client engine class,
   * typically at the beginning of client-side step processing {@see GameEngine#client__preStep}.
   *
   * @param {String} input - string representing the input
   * @param {Object} options - options for the input
   */
  sendRequest(name, payload) {
    let inputEvent = {
      command: `request`,
      data: {
        messageIndex: this.messageIndex,
        step: this.world.stepCount,
        action: name,
        payload
      }
    }

    this.gameEngine.trace.info(
      () =>
        `USER INPUT[${this.messageIndex}]: ${name} ${
          payload ? JSON.stringify(payload) : `{}`
        }`
    )

    // if we delay input application on client, then queue it
    // otherwise apply it now
    if (this.delayedInputs) {
      this.delayedInputs[this.delayedInputs.length - 1].push(inputEvent)
    } else {
      this.doRequestLocal(inputEvent)
    }

    if (this.options.standaloneMode !== true) {
      this.outboundMessages.push(inputEvent)
    }

    this.messageIndex++
  }

  // handle a message that has been received from the server
  handleInboundMessage(syncData) {
    let syncEvents = this.networkTransmitter.deserializePayload(syncData).events
    let syncHeader = syncEvents.find((e) => e.eventName === `syncHeader`)

    // emit that a snapshot has been received
    if (
      !this.highestServerStep ||
      syncHeader.stepCount > this.highestServerStep
    )
      this.highestServerStep = syncHeader.stepCount
    this.events.emit(`client__syncReceived`, {
      syncEvents: syncEvents,
      stepCount: syncHeader.stepCount,
      fullUpdate: syncHeader.fullUpdate
    })

    this.gameEngine.trace.info(
      () => `========== inbound world update ${syncHeader.stepCount} ==========`
    )

    // finally update the stepCount
    if (
      syncHeader.stepCount >
      this.world.stepCount +
        this.synchronizer.syncStrategy.STEP_DRIFT_THRESHOLDS.clientReset
    ) {
      this.gameEngine.trace.info(
        () =>
          `========== world step count updated from ${this.world.stepCount} to  ${syncHeader.stepCount} ==========`
      )
      this.events.emit(`client__stepReset`, {
        oldStep: this.world.stepCount,
        newStep: syncHeader.stepCount
      })
      this.world.stepCount = syncHeader.stepCount
    }
  }

  // emit an input to the authoritative server
  handleOutboundInput() {
    for (let x = 0; x < this.outboundMessages.length; x++) {
      this.socket.emit(
        this.outboundMessages[x].command,
        this.outboundMessages[x].data
      )
    }
    this.outboundMessages = []
  }
}

