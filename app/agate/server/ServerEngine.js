/* global AGate */

import Lance from '../libs/Lance'

export class ServerEngine extends Lance.ServerEngine {
  constructor(io, gameEngine, inputOptions) {
    super(io, gameEngine, inputOptions)
  }

  start() {
    super.start()
  }

  onPlayerConnected(socket) {
    super.onPlayerConnected(socket)
  }

  onPlayerDisconnected(socketId, playerId) {
    super.onPlayerDisconnected(socketId, playerId)

    delete this.gameEngine.world.objects[playerId]
  }
}
