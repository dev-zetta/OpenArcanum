//@flow

import Lance from '../libs/Lance'
import type GameEngine from '../shared/GameEngine'

const Server = require(`socket.io`)

export default class ServerEngine extends Lance.ServerEngine {

  _socketServer: Server

  /**
   *
   * @param gameEngine
   * @param options
   */
  constructor(gameEngine: GameEngine, options: Object) {
    //io.on(`connection`, client => {})

    const config = AGate.config.server
    let server = new Server()
    server.attach(config.listenPort, () =>
      lll(`Listening on ${config.listenPort}`)
    )

    /*server.on("connection", function(socket) {
      lll("user connected");
      socket.emit("welcome", "welcome man");
    });*/

    super(server, gameEngine, options)
    this._socketServer = server
  }

  /**
   *
   */
  start() {
    super.start()
  }

  /**
   *
   * @param socket
   */
  onPlayerConnected(socket: Object) {
    super.onPlayerConnected(socket)
  }

  /**
   *
   * @param socketId
   * @param playerId
   */
  onPlayerDisconnected(socketId: number, playerId: number) {
    super.onPlayerDisconnected(socketId, playerId)

    delete this.gameEngine.world.objects[playerId]
  }
}
