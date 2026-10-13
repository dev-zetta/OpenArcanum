import EventEmitter from 'eventemitter3'
import Utils from '../misc/Utils'
interface RTTSocket {
  on(event: 'RTTResponse' | 'RTTQuery', listener: (queryId: number) => void): unknown
  emit(event: 'RTTQuery' | 'RTTResponse', queryId: number): unknown
}
interface MonitoredClient {options: {healthCheckRTTSample: number; healthCheckInterval: number}; socket: RTTSocket}
export default class NetworkMonitor {
  declare server: {gameEngine: object} | undefined
  declare gameName: string | undefined
  readonly events = new EventEmitter<{RTTUpdate: [{RTT: number; RTTAverage: number}]}>()
  declare queryIdCounter: number
  declare RTTQueries: Record<number, number>
  declare movingRTTAverage: number
  declare movingRTTAverageFrame: number[]
  declare movingFPSAverageSize: number
  declare clientEngine: MonitoredClient
  declare private interval: ReturnType<typeof setInterval> | undefined
  constructor(server?: {gameEngine: object}) {
    this.server = server
    if (server) this.gameName = Object.getPrototypeOf(server.gameEngine).constructor.name as string
  }
  registerClient(clientEngine: MonitoredClient): void {
    this.queryIdCounter = 0
    this.RTTQueries = {}
    this.movingRTTAverage = 0
    this.movingRTTAverageFrame = []
    this.movingFPSAverageSize = clientEngine.options.healthCheckRTTSample
    this.clientEngine = clientEngine
    clientEngine.socket.on('RTTResponse', this.onReceivedRTTQuery.bind(this))
    this.interval = setInterval(this.sendRTTQuery.bind(this), clientEngine.options.healthCheckInterval)
  }
  sendRTTQuery(): void {
    this.RTTQueries[this.queryIdCounter] = Utils.getCurrentTimestamp()
    this.clientEngine.socket.emit('RTTQuery', this.queryIdCounter++)
  }
  onReceivedRTTQuery(queryId: number): void {
    const start = this.RTTQueries[queryId]
    if (!Number.isSafeInteger(queryId) || typeof start !== 'number') return
    const RTT = Utils.getCurrentTimestamp() - start
    delete this.RTTQueries[queryId]
    this.movingRTTAverageFrame.push(RTT)
    if (this.movingRTTAverageFrame.length > this.movingFPSAverageSize) this.movingRTTAverageFrame.shift()
    this.movingRTTAverage = this.movingRTTAverageFrame.reduce((a, b) => a + b, 0) / this.movingRTTAverageFrame.length
    this.events.emit('RTTUpdate', {RTT, RTTAverage: this.movingRTTAverage})
  }
  registerPlayerOnServer(socket: RTTSocket): void { socket.on('RTTQuery', this.respondToRTTQuery.bind(this, socket)) }
  respondToRTTQuery(socket: RTTSocket, queryId: number): void { socket.emit('RTTResponse', queryId) }
  close(): void { if (this.interval) clearInterval(this.interval); this.interval = undefined }
}
