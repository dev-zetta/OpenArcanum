import EventEmitter from 'eventemitter3'
import http from 'http'
import Utils from '../misc/Utils';

/**
 * Measures network performance between the client and the server
 * Represents both the client and server portions of NetworkMonitor
 */
export default class NetworkMonitor {
  constructor(server) {
    // server-side keep game name
    if (server) {
      this.server = server
      this.gameName = Object.getPrototypeOf(server.gameEngine).constructor.name
    }

    // mixin for EventEmitter
    this.events = new EventEmitter()
  }

  // client
  registerClient(clientEngine) {
    this.queryIdCounter = 0
    this.RTTQueries = {}

    this.movingRTTAverage = 0
    this.movingRTTAverageFrame = []
    this.movingFPSAverageSize = clientEngine.options.healthCheckRTTSample
    this.clientEngine = clientEngine
    clientEngine.socket.on(`RTTResponse`, this.onReceivedRTTQuery.bind(this))
    setInterval(
      this.sendRTTQuery.bind(this),
      clientEngine.options.healthCheckInterval
    )
  }

  sendRTTQuery() {
    // todo implement cleanup of older timestamp
    this.RTTQueries[this.queryIdCounter] = Utils.getCurrentTimestamp()
    this.clientEngine.socket.emit(`RTTQuery`, this.queryIdCounter)
    this.queryIdCounter++
  }

  onReceivedRTTQuery(queryId) {
    let RTT = Utils.getCurrentTimestamp() - this.RTTQueries[queryId]

    this.movingRTTAverageFrame.push(RTT)
    if (this.movingRTTAverageFrame.length > this.movingFPSAverageSize) {
      this.movingRTTAverageFrame.shift()
    }
    this.movingRTTAverage =
      this.movingRTTAverageFrame.reduce((a, b) => a + b) /
      this.movingRTTAverageFrame.length
    this.events.emit(`RTTUpdate`, {
      RTT: RTT,
      RTTAverage: this.movingRTTAverage
    })
  }

  // server
  registerPlayerOnServer(socket) {
    socket.on(`RTTQuery`, this.respondToRTTQuery.bind(this, socket))
  }

  respondToRTTQuery(socket, queryId) {
    socket.emit(`RTTResponse`, queryId)
  }
}
