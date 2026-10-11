//@flow

import ServerNetwork from './ServerNetwork'
import type GameEngine from '../shared/GameEngine'



export default class ServerEngine extends ServerNetwork {


  /**
   *
   * @param gameEngine
   * @param options
   */
  constructor(gameEngine: GameEngine, options: Object) {
    super(gameEngine, options)
  }

  /**
   *
   */
  async start() {
    return super.start()
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
   * Add object to the game world.
   * On the client side, the object may not be created, if the server copy
   * of this object is already in the game world.  This could happen when the client
   * is using delayed-input, and the RTT is very low.
   *
   * @param {Object} object - the object.
   * @return {Object} the final object.
   */
  addDynamicEntityToWorld(object, world) {
    // if we are asked to create a local shadow object
    // the server copy may already have arrived.
    if (Number(object.id) >= this.options.clientIDSpace) {
      let serverCopyArrived = false

      const entities = world.getDynamicEntities()
      for (const [id, entity] of entities) {
        if (entity.inputId === object.inputId) {
          serverCopyArrived = true
          break
        }
      }

      if (serverCopyArrived) {
        this.trace.info(
          () =>
            `========== shadow object NOT added ${object.toString()} ==========`
        )
        return null
      }
    }

    world.addObject(object)

    this.events.emit(`objectAdded`, object)
    this.trace.info(
      () => `========== object added ${object.toString()} ==========`
    )

    return object
  }

  /**
   * Remove an object from the game world.
   *
   * @param {Object|String} objectId - the object or object ID
   */
  removeDynamicEntityFromWorld(objectId, world) {
    if (typeof objectId === `object`) {
      objectId = objectId.id
    }

    let object = world.getDynamicEntity(objectId)

    if (!object) {
      throw new Error(
        `Game attempted to remove a game object which doesn't (or never did) exist, id=${objectId}`
      )
    }
    this.trace.info(
      () => `========== destroying object ${object.toString()} ==========`
    )

    this.events.emit(`objectDestroyed`, object)
    world.removeObject(objectId)
  }





  // handle the object creation
  onObjectAdded(obj) {
    super.onObjectAdded(obj)
  }

  // handle the object creation
  onObjectDestroyed(obj) {
    super.onObjectDestroyed(obj)
  }


  // add an input to the input-queue for the specific player
  // each queue is key'd by step, because there may be multiple inputs
  // per step
  queueInputForPlayer(data, playerId) {
    super.queueInputForPlayer(data, playerId)
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
