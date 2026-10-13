import type {Socket as PeerSocket} from 'socket.io'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'
import type StepState from '../shared/StepState'
import type Entity from '../shared/entity/Entity'
import type {SerializeResult} from '../shared/serialize/Serializable'
import Serializer from '../shared/serialize/Serializer'
import NetworkTransmitter from '../shared/network/NetworkTransmitter'
import GameWorld from './World'
import Socket from './Socket'
import Player from './Player'

export interface LegacyInput {step: number; messageIndex?: number; input?: string; [field: string]: unknown}
export interface LegacyNetworkProvider {
  authenticate(socket: PeerSocket, data: Record<string, unknown>): Player | Promise<Player>
  processCommand(input: LegacyInput, playerId: string, world: GameWorld): void
  createWorld?(engine: GameEngine, settings: Record<string, unknown>): Promise<GameWorld>
  serializeUpdate?(map: GameMap, options: {diffUpdate: boolean}, server: ServerNetwork): SerializeResult | null
  registerClasses?(serializer: Serializer): void
}
export interface LegacyServerOptions {
  listenPort?: number
  stepRate?: number
  updateRate?: number
  fullSyncRate?: number
  timeoutInterval?: number
  updateOnObjectCreation?: boolean
  tracesPath?: string
  countConnections?: boolean
  clientIDSpace?: number
  debug?: Record<string, unknown>
  legacyProvider?: LegacyNetworkProvider
}
interface ConnectedPlayer {player: Player; socket: PeerSocket; lastHandledInput?: number; joinTime: number; idleTimeout?: ReturnType<typeof setTimeout>}

/** Retained old networking API. The playable game uses server/authority. */
export default class ServerNetwork {
  declare readonly gameEngine: GameEngine
  declare readonly options: LegacyServerOptions & {stepRate: number; updateRate: number; fullSyncRate: number; timeoutInterval: number; updateOnObjectCreation: boolean; clientIDSpace: number}
  readonly serializer = new Serializer()
  readonly worlds = new Map<string, GameWorld>()
  readonly connectedPlayers: Record<string, ConnectedPlayer> = {}
  readonly playerInputQueues: Record<string, Record<number, LegacyInput[]>> = {}
  readonly objMemory: Record<string, ArrayBufferLike> = {}
  declare socket: Socket
  declare networkTransmitter: NetworkTransmitter
  declare private tickTimer: ReturnType<typeof setInterval> | undefined
  declare serverTime: number

  constructor(gameEngine: GameEngine, options: LegacyServerOptions = {}) {
    this.gameEngine = gameEngine
    this.options = {stepRate: 60, updateRate: 6, fullSyncRate: 20, timeoutInterval: 180,
      updateOnObjectCreation: true, clientIDSpace: 1000000, ...options}
  }
  get events() { return this.gameEngine.events }
  get trace() { return this.gameEngine.trace }
  private provider(): LegacyNetworkProvider {
    if (!this.options.legacyProvider) throw new Error('Legacy multiplayer scaffolding requires an explicit LegacyNetworkProvider; use the authoritative local server for gameplay')
    return this.options.legacyProvider
  }
  getWorld(id: string): GameWorld | undefined { return this.worlds.get(id) }
  async createWorld(options: Record<string, unknown> = {}): Promise<GameWorld> {
    const provider = this.options.legacyProvider
    const world = provider?.createWorld ? await provider.createWorld(this.gameEngine, options) : new GameWorld(this.gameEngine, options)
    if (!provider?.createWorld) await world.init(options)
    this.worlds.set(world.id, world)
    return world
  }
  async start(): Promise<void> {
    const provider = this.provider() // Fail before opening a port or scheduling work.
    if (this.tickTimer) return
    provider.registerClasses?.(this.serializer)
    this.networkTransmitter = new NetworkTransmitter(this.serializer)
    await this.createWorld({id: 'default'})
    this.socket = new Socket(this.options.listenPort)
    this.socket.on('connection', socket => this.onConnection(socket))
    let previous = performance.now()
    this.tickTimer = setInterval(() => {
      const now = performance.now()
      this.step({time: now, elapsed: now - previous, isReenact: false, physicsOnly: false})
      previous = now
    }, 1000 / this.options.stepRate)
    this.events.emit('server__init')
  }
  async stop(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = undefined
    for (const player of Object.values(this.connectedPlayers)) if (player.idleTimeout) clearTimeout(player.idleTimeout)
    if (this.socket) await this.socket.close()
  }
  step(state?: StepState): void {
    const next = state || {time: performance.now(), elapsed: 1000 / this.options.stepRate, isReenact: false, physicsOnly: false}
    for (const world of this.worlds.values()) this.updateWorld(next, world)
  }
  updateWorld(state: StepState, world: GameWorld): void {
    this.events.emit('preStep', {world, state})
    this.serverTime = Date.now()
    for (const [playerId, queue] of Object.entries(this.playerInputQueues)) {
      for (const step of Object.keys(queue).map(Number).sort((a, b) => a - b)) {
        if (step > world.stepCount) break
        for (const input of queue[step]) this.provider().processCommand(input, playerId, world)
        delete queue[step]
      }
    }
    world.stepCount++
    this.syncStateToClients(world)
    this.events.emit('postStep', {world, state})
  }
  syncStateToClients(world: GameWorld): void {
    if (!world.requestImmediateSync && world.stepCount % this.options.updateRate !== 0) return
    let diffUpdate = !world.requestFullSync && world.syncCounter++ % this.options.fullSyncRate !== 0
    for (const player of world.players.values()) if (player.state === 'new') { player.state = 'synced'; diffUpdate = false }
    for (const map of world.maps.values()) {
      const payload = this.serializeUpdate(map, {diffUpdate})
      for (const player of world.players.values()) player.socket.emit('worldUpdate', payload)
      this.networkTransmitter.clearPayload()
    }
    world.requestImmediateSync = world.requestFullSync = false
  }
  serializeUpdate(map: GameMap, options: {diffUpdate?: boolean} = {}): SerializeResult | null {
    const diffUpdate = Boolean(options.diffUpdate)
    const custom = this.options.legacyProvider?.serializeUpdate
    if (custom) return custom(map, {diffUpdate}, this)
    const world = map.world
    this.networkTransmitter.addNetworkedEvent('syncHeader', {stepCount: world.stepCount, fullUpdate: Number(!diffUpdate)})
    for (const [id, entity] of world.getDynamicEntities()) {
      if (entity.map.id !== map.id) continue
      const current = entity.serialize(this.serializer).dataBuffer
      const previous = this.objMemory[id]
      if (current && previous && diffUpdate && this.buffersEqual(current, previous)) continue
      if (current) this.objMemory[id] = current
      this.networkTransmitter.addNetworkedEvent('objectUpdate', {stepCount: world.stepCount, objectInstance: entity})
    }
    return this.networkTransmitter.serializePayload()
  }
  private buffersEqual(left: ArrayBufferLike, right: ArrayBufferLike): boolean {
    if (left.byteLength !== right.byteLength) return false
    const a = new Uint8Array(left), b = new Uint8Array(right)
    return a.every((value, index) => value === b[index])
  }
  assignPlayerToWorld(player: Player, world: GameWorld): void {
    const old = player.worldId && this.worlds.get(player.worldId)
    if (old) old.players.delete(player.id)
    player.worldId = world.id
    world.players.set(player.id, player)
    world.requestImmediateSync = world.requestFullSync = true
    const update = {playerId: player.id, to: world.id}
    player.socket.emit('worldUpdate', update)
    this.events.emit('server__worldUpdate', update)
  }
  onObjectAdded(entity: Entity): void {
    this.networkTransmitter.addNetworkedEvent('objectCreate', {stepCount: entity.world.stepCount, objectInstance: entity})
    if (this.options.updateOnObjectCreation) {
      const world = this.worlds.get(entity.world.id)
      if (world) world.requestImmediateSync = true
    }
  }
  onObjectDestroyed(entity: Entity): void { this.networkTransmitter.addNetworkedEvent('objectDestroy', {stepCount: entity.world.stepCount, objectInstance: entity}) }
  async getPlayer(socket: PeerSocket, data: Record<string, unknown>): Promise<Player> { return this.provider().authenticate(socket, data) }
  bindPlayerEvent(player: Player, name: 'joinServer' | 'disconnect'): void {
    if (name === 'joinServer') player.socket.on(name, (data: Record<string, unknown>) => {
      void this.onJoinServer(player.socket, data).catch((error: unknown) => {
        player.socket.emit('serverError', {message: error instanceof Error ? error.message : String(error)})
      })
    })
    else player.socket.on(name, () => this.onDisconnect(player.socket))
  }
  emitSocketEvent(socket: PeerSocket, name: string, payload: Record<string, unknown>): void { socket.emit(name, payload) }
  onConnection(socket: PeerSocket): void {
    const player = new Player(socket)
    this.bindPlayerEvent(player, 'joinServer')
    this.bindPlayerEvent(player, 'disconnect')
  }
  onDisconnect(socket: PeerSocket): void {
    const entry = this.connectedPlayers[socket.id]
    if (!entry) return
    if (entry.idleTimeout) clearTimeout(entry.idleTimeout)
    if (entry.player.worldId) this.worlds.get(entry.player.worldId)?.players.delete(entry.player.id)
    delete this.playerInputQueues[entry.player.id]
    delete this.connectedPlayers[socket.id]
  }
  async onJoinServer(socket: PeerSocket, data: Record<string, unknown>): Promise<void> {
    const player = await this.getPlayer(socket, data)
    const world = this.worlds.get(typeof data.worldId === 'string' ? data.worldId : 'default')
    if (!world) throw new Error('Unknown legacy world')
    this.connectedPlayers[socket.id] = {player, socket, joinTime: Date.now()}
    this.assignPlayerToWorld(player, world)
    socket.on('request', (input: LegacyInput) => this.onRequest(input, socket))
    this.resetIdleTimeout(socket)
    socket.emit('playerJoined', {id: socket.id, playerId: player.id, joinTime: Date.now(), disconnectTime: 0})
  }
  onRequest(input: LegacyInput, socket: PeerSocket): void {
    const entry = this.connectedPlayers[socket.id]
    if (!entry) throw new Error('Legacy input requires an authenticated player')
    entry.lastHandledInput = input.messageIndex
    this.resetIdleTimeout(socket)
    this.queueInputForPlayer(input, entry.player.id)
  }
  onPlayerTimeout(socket: PeerSocket): void { socket.disconnect() }
  resetIdleTimeout(socket: PeerSocket): void {
    const entry = this.connectedPlayers[socket.id]
    if (!entry) return
    if (entry.idleTimeout) clearTimeout(entry.idleTimeout)
    if (this.options.timeoutInterval > 0) entry.idleTimeout = setTimeout(() => this.onPlayerTimeout(socket), this.options.timeoutInterval * 1000)
  }
  queueInputForPlayer(input: LegacyInput, playerId: string): void {
    if (!Number.isSafeInteger(input.step) || input.step < 0) throw new Error('Invalid legacy input step')
    const queue = this.playerInputQueues[playerId] ||= {}
    ;(queue[input.step] ||= []).push(input)
  }
  processCommand(input: LegacyInput, playerId: string): void {
    const player = Object.values(this.connectedPlayers).find(entry => entry.player.id === playerId)?.player
    const world = player?.worldId && this.worlds.get(player.worldId)
    if (!world) throw new Error('Legacy input has no assigned world')
    this.provider().processCommand(input, playerId, world)
  }
  findLocalShadow(entity: Entity): Entity | null {
    for (const world of this.worlds.values()) for (const [id, candidate] of world.getDynamicEntities()) {
      if (Number(id) >= this.options.clientIDSpace && Reflect.get(candidate, 'inputId') === Reflect.get(entity, 'inputId')) return candidate
    }
    return null
  }
  gameStatus(): string { return JSON.stringify({numPlayers: Object.keys(this.connectedPlayers).length, upTime: 0, cpuLoad: 0, memoryLoad: 0,
    players: Object.fromEntries(Object.keys(this.connectedPlayers).map(id => [id, {frameRate: 0}]))}) }
}
