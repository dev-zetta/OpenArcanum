//@flow

import ServerNetwork from './ServerNetwork'
import type GameEngine from '../shared/GameEngine'



export default class ServerEngine extends ServerNetwork {


  /**
   *
   * @param engine
   * @param options
   */
  constructor(engine: GameEngine, options: Object) {
    super(engine, options)

    this.engine = engine
    this.engine.server = this
  }

  /**
   *
   */
  async start() {
    super.start()
  }

  // every server step starts here
  step() {
    super.step()
  }

  /**
   *
   * @param roomName
   */
  syncStateToClients(roomName) {
    super.syncStateToClients(roomName)
  }

  // create a serialized package of the game world
  //       size calculation are done in a single phase, along with string pruning.
  serializeUpdate(roomName, options): Object {
    return super.serializeUpdate(roomName, options)
  }

  /**
   * Create a room
   *
   * There is a default room called "/lobby".  All newly created players
   * and objects are assigned to the default room.  When the server sends
   * periodic syncs to the players, each player is only sent those objects
   * which are present in his room.
   *
   * @param {String} roomName - the new room name
   */
  createRoom(roomName: string) {
    super.createRoom(roomName)
  }

  /**
   * Assign an object to a room
   *
   * @param {Object} obj - the object to move
   * @param {String} roomName - the target room
   */
  assignObjectToRoom(obj, roomName) {
    super.assignObjectToRoom(obj, roomName)
  }

  /**
   * Assign a player to a room
   *
   * @param {Number} playerId - the playerId
   * @param {String} roomName - the target room
   */
  assignPlayerToRoom(playerId, roomName) {
    super.assignPlayerToRoom(playerId, roomName)
  }

  // handle the object creation
  onObjectAdded(obj) {
    super.onObjectAdded(obj)
  }

  // handle the object creation
  onObjectDestroyed(obj) {
    super.onObjectDestroyed(obj)
  }



  /**
   *
   * @param socket
   */
  onPlayerConnected(socket: Object) {
    lll('player connected', socket)
    super.onPlayerConnected(socket)
  }

  /**
   *
   * @param socketId
   * @param playerId
   */
  onPlayerDisconnected(socketId: number, playerId: number) {
    lll('player disconnected', socket)
    super.onPlayerDisconnected(socketId, playerId)

    //delete this.gameEngine.world.objects[playerId]
  }

  // handle player timeout
  onPlayerTimeout(socket) {
    super.onPlayerTimeout(socket)
  }


  // add an input to the input-queue for the specific player
  // each queue is key'd by step, because there may be multiple inputs
  // per step
  queueInputForPlayer(data, playerId) {
    super.queueInputForPlayer(data, playerId)
  }



  /**
   *  an input has been received from a client, queue it for next step. lance
   * @param data
   * @param socket
   */
  onReceivedInput(data, socket) {
    lll('onReceivedInput', data, socket)
    super.onReceivedInput(data, socket)
  }


  /**
   * Report game status
   * This method is only relevant if the game uses MatchMaker functionality.
   * This method must return the game status.
   *
   * @return {String} Stringified game status object.
   */
  gameStatus(): string {
    return super.gameStatus()
  }



}
