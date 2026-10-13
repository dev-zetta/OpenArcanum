//@flow
import type AGateEngine from '../AGate'


import type AssetLoader from './assets/AssetLoader'
import type EventEmitter from './misc/EventEmitter'
import type Database from './realm/Database'

import Entity from './entity/Entity'
import Utils from '../shared/misc/Utils'
import GameWorld from './GameWorld';

import Trace from './misc/Trace';
import StepState from './StepState';
import ClientEngine from '../client/ClientEngine';
import ServerEngine from '../server/ServerEngine';


/**
 * EVENTS
 */

/**
 * Marks the beginning of a new game step
 *
 * @event GameEngine#preStep
 * @param {Number} stepNumber - the step number
 * @param {Boolean} isReenact - is this step a re-enactment
 */

/**
 * Marks the end of a game step
 *
 * @event GameEngine#postStep
 * @param {Number} stepNumber - the step number
 * @param {Boolean} isReenact - is this step a re-enactment
 */

/**
 * An object has been added to the world
 *
 * @event GameEngine#objectAdded
 * @param {Object} obj - the new object
 */

/**
 * An object has been removed from the world
 *
 * @event GameEngine#objectDestroyed
 * @param {Object} obj - the object
 */

/**
 * A player has joined
 *
 * @event GameEngine#playerJoined
 * @param {Number} joinTime - epoch of join time
 * @param {Object} playerDesc - player descriptor
 * @param {String} playerDesc.playerId - the player ID
 */

/**
 * A player has left
 *
 * @event GameEngine#playerDisconnected
 * @param {Number} joinTime - epoch of join time
 * @param {Number} disconnectTime - epoch of disconnect time
 * @param {Object} playerDesc - player descriptor
 * @param {String} playerDesc.playerId - the player ID
 */

/**
 * A player has joined on the server
 *
 * @event GameEngine#server__playerJoined
 * @param {Number} joinTime - epoch of join time
 * @param {Object} playerDesc - player descriptor
 * @param {String} playerDesc.playerId - the player ID
 */

/**
 * A player has left on the server
 *
 * @event GameEngine#server__playerDisconnected
 * @param {Number} joinTime - epoch of join time
 * @param {Number} disconnectTime - epoch of disconnect time
 * @param {Object} playerDesc - player descriptor
 * @param {String} playerDesc.playerId - the player ID
 */

/**
 * A synchronization update arrived from the server
 *
 * @event GameEngine#syncReceived
 * @param {Object} sync - the synchronization object
 */

/**
 * Marks the beginning of a game step on the client
 *
 * @event GameEngine#client__preStep
 */

/**
 * Marks the end of a game step on the client
 *
 * @event GameEngine#client__postStep
 */

/**
 * An input needs to be handled.  Emitted just before the GameEngine
 * method processInput is invoked.
 *
 * @event GameEngine#processInput
 * @param {Object} input - input descriptor object
 * @param {String} input.input - describe the input (e.g. "up", "down", "fire")
 * @param {Number} input.messageIndex - input identifier
 * @param {Object} input.options - the object which was passed as SendInput's InputOptions parameter
 * @param {Number} input.step - input execution step
 * @param {Number} playerId - the player ID
 */

/**
 * An input needs to be handled.
 * This event is emitted on the server only, just before the
 * general processInput event.
 *
 * @event GameEngine#server__processInput
 * @param {Object} input - input descriptor object
 * @param {String} input.input - describe the input (e.g. "up", "down", "fire")
 * @param {Number} input.messageIndex - input identifier
 * @param {Object} input.options - the object which was passed as SendInput's InputOptions parameter
 * @param {Number} input.step - input execution step
 * @param {Number} playerId - the player ID
 */

/**
 * Client moved from one room to another
 *
 * @event GameEngine#server__roomUpdate
 * @param {Number} playerId - the player ID
 * @param {String} from - the room from which the client came
 * @param {String} to - the room to which the client went
 */

/**
 * An input needs to be handled.
 * This event is emitted on the client only, just before the
 * general processInput event.
 *
 * @event GameEngine#client__processInput
 * @param {Object} input - input descriptor object
 * @param {String} input.input - describe the input (e.g. "up", "down", "fire")
 * @param {Number} input.messageIndex - input identifier
 * @param {Object} input.options - the object which was passed as SendInput's InputOptions parameter
 * @param {Number} input.step - input execution step
 * @param {Number} playerId - the player ID
 */

/**
 * Client received a sync from the server
 *
 * @event GameEngine#client__syncReceived
 * @param {Object} sync - sync from the server
 * @param {Array} syncEvents - array of events in the sync
 * @param {Number} maxStepCount - highest step in the sync
 */

/**
 * Client moved from one room to another
 *
 * @event GameEngine#client__roomUpdate
 * @param {Number} playerId - the player ID
 * @param {String} from - the room from which the client came
 * @param {String} to - the room to which the client went
 */

/**
 * Client reset the world step
 *
 * @event GameEngine#client__stepReset
 * @param {Object} resetDesc - sync from the server
 * @param {Number} oldStep - the old step count
 * @param {Number} newStep - the new step count
 */

/**
 * Marks the beginning of a game step on the server
 *
 * @event GameEngine#server__preStep
 * @param {Number} stepNumber - the step number
 */

/**
 * Marks the end of a game step on the server
 *
 * @event GameEngine#server__postStep
 * @param {Number} stepNumber - the step number
 */

/**
 * User input received on the server
 *
 * @event GameEngine#server__inputReceived
 * @param {Object} input - input descriptor
 * @param {Object} input.data - input descriptor
 * @param {String} input.playerId - player that sent the input
 */

/**
 * Report slow frame rate on the browser.
 * The browser did not achieve a reasonable frame rate
 *
 * @event GameEngine#client__slowFrameRate
 */

/**
 * server has started
 *
 * @event GameEngine#start
 * @param {Number} timestamp - UTC epoch of start time
 */


/**
 * The GameEngine contains the game logic.  Extend this class
 * to implement game mechanics.  The GameEngine derived
 * instance runs once on the server, where the final decisions
 * are always taken, and one instance will run on each client as well,
 * where the client emulates what it expects to be happening
 * on the server.
 *
 * The game engine's logic must listen to user inputs and
 * act on these inputs to change the game state.  For example,
 * the game engine listens to controller/keyboard inputs to infer
 * movement for the player/ship/first-person.  The game engine listens
 * to clicks, button-presses to infer firing, etc..
 *
 * Note that the game engine runs on both the server and on the
 * clients - but the server decisions always have the final say,
 * and therefore clients must resolve server updates which conflict
 * with client-side predictions.
 */

export default class GameEngine {
  options: Object

  assetLoader: AssetLoader
  events: EventEmitter
  database: Database
  client: ClientEngine
  server: ServerEngine

  physicsEngine: ?Object
  trace: Trace

  /**
   *
   */
  constructor(core: AGateEngine, options: Object) {
    const defaultOpts = {traceLevel: Trace.TRACE_ERROR}
    this.options = Object.assign(defaultOpts, options)
    this.trace = new Trace({traceLevel: this.options.traceLevel})
    this.core = core

    this.assetLoader = core.assetLoader
    this.events = core.eventEmitter
    this.database = core.database


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
   */
  async load() {

  }




  /**
   *
   * @param path
   * @param command
   */
  // sendCommand(path: string | Array, command: Object) {
  //   lll(`Game: Sending command`, path, command)
  //
  //   this.events.emit(`${source}.Command`, {
  //     type: name,
  //     command
  //   })
  // }

  //onPlayerCommand({ player: Entity, type: string }: Object) {}




  /**
   * Register Game Object Classes
   *
   * @example
   * registerClasses(serializer) {
   *   serializer.registerClass(Paddle);
   *   serializer.registerClass(Ball);
   * }
   *
   * @param {Serializer} serializer - the serializer
   */
  /**
   * Register Game Object Classes
   * @param serializer
   */
  registerClasses(serializer: Object) {
    serializer.registerClass(Entity)
  }




  /**
   *
   * @returns {Promise<void>}
   */
  async init() {
    await this.assetLoader.initialize()
    //await this.database.initialize()
    //await this.engine.init()

    //if (this.options.server) {
      if (this.options.standaloneMode !== true) await this.createServer()
    //}
  }


  /**
   *
   * @param canvas
   * @returns {Promise<ClientEngine>}
   */
  async createClient(canvas: HTMLCanvasElement, options: Object = {}): Promise<ClientEngine> {
    this.options = { ...this.options, ...options }
    await this.init()
    options.signal?.throwIfAborted()

    this.events.on(`Client:Created`, this.onClientCreated, this)
    this.client = new ClientEngine(this, this.options)
    const cancel = () => this.client.stop()
    options.signal?.addEventListener('abort', cancel, { once: true })
    try {
      await this.client.create(canvas)
      this.client.assertStartupActive()
      await this.load()
      this.client.assertStartupActive()
      if (this.options.authoritySession) {
        await this.client.startLocalAuthority(this.options.mapId, this.options.authoritySession)
      } else if (this.options.standaloneMode === true) {
        await this.client.startOffline(this.options.mapId)
      }
      return this.client
    } catch (error) {
      this.client.stop()
      throw error
    } finally { options.signal?.removeEventListener('abort', cancel) }
  }

  /**
   *
   * @returns {Promise<ServerEngine>}
   */
  async createServer(): Promise<ServerEngine> {
    let config = this.getConfig('server')
    this.server = new ServerEngine(this, {
      listenPort: config.listenPort,
      debug: {},
      updateRate: 6,
      timeoutInterval: 0 // no timeout
    })

    await this.server.start()

    return this.server
  }

  onClientCreated() {


  }

}
