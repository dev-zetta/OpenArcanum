import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { Server } from 'socket.io'
import AssetLoader from '../../shared/assets/AssetLoader'
import EventEmitter from '../../shared/misc/EventEmitter'
import GameWorld from '../../shared/GameWorld'
import Location from '../../shared/Location'
import Utils from '../../shared/misc/Utils'
import Sector from '../../shared/map/Sector'
import StreamZip from 'node-stream-zip'
import DoorInteractions from './DoorInteractions'
import ContainerInteractions from './ContainerInteractions'
import GroundInteractions from './GroundInteractions'
import ConversationInteractions from './ConversationInteractions'
import CharacterProgression from './CharacterProgression'
import { ATTRIBUTE_IDS } from '../../shared/character/NeutralStats'
import InventoryOwnership, { prepareOwnWrites } from './InventoryOwnership'
import { loadItemDisplayCatalog } from './ItemDisplayCatalog'
import CheckpointStore from './CheckpointStore'
import { captureContentIdentity, CHECKPOINT_RULES_VERSION as RULES_VERSION } from './ContentIdentity'

export const PROTOCOL_VERSION = 1
export const DEFAULT_MAP = 'Bates Mansion Lev 2'
const STEP_DURATION_MS = 1000
const ACTOR_ID = '0'
const CHECKPOINT_FORMAT = 'openarcanum-local-checkpoint'
const CHECKPOINT_ERRORS = {
  CHECKPOINT_NOT_FOUND: 'No local checkpoint has been saved yet',
  CHECKPOINT_INVALID: 'The local checkpoint is invalid or cannot be safely restored',
  CHECKPOINT_INCOMPATIBLE: 'The local checkpoint belongs to different content or rules',
  CHECKPOINT_IO_ERROR: 'The local checkpoint could not be read or written',
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

function checkpointError(code) {
  return Object.assign(new Error(CHECKPOINT_ERRORS[code]), { code })
}

function tokenMatches(actual, expected) {
  if (typeof actual !== 'string') return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function validateMapId(mapId) {
  if (typeof mapId !== 'string' || !mapId.trim() || mapId.length > 128 ||
      /[\\/\x00-\x1f]/.test(mapId) || mapId === '.' || mapId === '..') {
    throw new Error('mapId must be a converted map directory name')
  }
  return mapId
}

function openGeometryArchive(loader, filename) {
  return new Promise((resolve, reject) => {
    const zipId = loader.archives.length
    const archive = new StreamZip({ file: filename, storeEntries: false,
      skipEntryNameValidation: true })
    // Retain the handle before indexing, so failed or interrupted startup can
    // close it as reliably as a successfully loaded map.
    loader.archives.push(archive)
    archive.on('entry', entry => {
      if (entry.isDirectory) return
      const parts = entry.name.split('/')
      let parent = loader.archiveEntries
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index]
        if (index === parts.length - 1) {
          entry.zipId = zipId
          parent.set(part, entry)
        } else {
          if (!parent.has(part)) parent.set(part, new Map())
          parent = parent.get(part)
        }
      }
    })
    archive.once('error', reject)
    archive.once('ready', () => resolve(archive))
  })
}

async function loadOptionalRules(loader, dataPath, filename, maxBytes) {
  const [directory, name] = filename.split('/')
  let present = loader.archiveEntries.get(directory)?.has(name) === true
  try { await fs.access(path.join(dataPath, filename)); present = true }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!present) return null
  const bytes = await loader.loadFile(filename)
  if (bytes && bytes.length > maxBytes) throw new Error('Authored rules are too large')
  const rules = await loader.loadJsonFile(filename)
  if (!rules) throw new Error('Authored rules could not be read')
  return rules
}

/**
 * A single-actor local authority checkpoint. Geometry and pathfinding belong to
 * the host; clients submit only an integer destination and render snapshots.
 * This is not the legacy multiplayer experiment or a public hosting service.
 */
export class AuthorityServer {
  constructor(options = {}) {
    if (typeof options.dataPath !== 'string' || !options.dataPath) {
      throw new Error('A converted dataPath is required')
    }
    this.options = { port: 0, tickMs: 50, allowPause: true, ...options }
    this.mapId = validateMapId(options.mapId || DEFAULT_MAP)
    if (!Number.isInteger(this.options.port) || this.options.port < 0 || this.options.port > 65535) {
      throw new Error('port must be an integer between 0 and 65535')
    }
    if (!Number.isInteger(this.options.tickMs) || this.options.tickMs < 10 || this.options.tickMs > 1000) {
      throw new Error('tickMs must be an integer between 10 and 1000')
    }
    if (typeof this.options.allowPause !== 'boolean') throw new Error('allowPause must be a boolean')
    this.ownerToken = options.ownerToken || randomBytes(32).toString('hex')
    this.observerToken = options.observerToken || randomBytes(32).toString('hex')
    if (![this.ownerToken, this.observerToken].every(value => typeof value === 'string' && value.length >= 32) ||
        this.ownerToken === this.observerToken) {
      throw new Error('Distinct owner and observer tokens of at least 32 characters are required')
    }
    this.revision = 0
    this.lastCommandId = 0
    this.lastCommand = null
    this.movement = null
    this.timer = null
    this.stopped = false
    this.started = false
    this._stopPromise = null
    this.checkpointBusy = false
    this.checkpointState = { supported: true, busy: false }
    // Pause is a transient host policy and never part of a checkpoint. The
    // monotonic timestamp excludes suspended time from an accepted movement.
    this.paused = false
    this.pausedAt = null
  }

  async loadWorld() {
    const dataPath = await fs.realpath(this.options.dataPath)
    if (!(await fs.stat(dataPath)).isDirectory()) throw new Error('dataPath must be a directory')
    // Existing converted-data classes resolve through AGate. Keep the adapter
    // deliberately small: it neither creates a client nor opens a graphics API.
    this.previousAGate = globalThis.AGate
    this.previousLog = globalThis.lll
    this.previousErrorLog = globalThis.lle
    this.core = {
      config: { dataPath },
      Utils,
      getDataPath: value => value || '',
      getAppPath: value => path.isAbsolute(value || '') ? value : path.join(dataPath, value || ''),
    }
    globalThis.AGate = this.core
    globalThis.lll = () => {}
    globalThis.lle = (...args) => console.error(...args)
    this.assetLoader = new AssetLoader()
    const capture = captureContentIdentity(this.assetLoader, { dataPath })
    this.checkpointStore = new CheckpointStore(this.options.checkpointPath || path.join(dataPath, 'saves', 'local-checkpoint.json'))
    // Graphics archives can contain millions of entries. The headless host
    // needs prototypes and its own map only; loose recovered geometry still
    // takes precedence through AssetLoader.loadFile.
    this.assetLoader.archiveEntries = new Map()
    for (const name of ['Prototypes.zip', `${this.mapId}.zip`]) {
      const filename = path.join(dataPath, 'archives', name)
      try { await fs.access(filename) } catch { continue }
      await openGeometryArchive(this.assetLoader, filename)
    }
    const events = new EventEmitter()
    this.engine = { options: { headless: true, standaloneMode: true },
      assetLoader: this.assetLoader, events }
    this.world = new GameWorld(this.engine, { id: 'local-authority' })
    await this.world.init({})
    this.map = await this.world.loadMap(this.mapId)
    this.doors = new DoorInteractions(this.map, {
      canUseKey: (actor, keyId) => this.ownership?.hasKey(actor, keyId) === true,
      canEverUseKey: keyId => this.ownership?.canEverUseKey(keyId) === true,
    })
    this.containers = new ContainerInteractions(this.map, {
      canUseKey: (actor, keyId) => this.ownership?.hasKey(actor, keyId) === true,
    })
    const spawn = this.map.getStartLocation()
    // Never let an actor's converted file move the authoritative spawn or let
    // a client select it. Fail closed if this checkpoint does not fit the map.
    if (this.map.isTileBlocked(spawn)) throw new Error(`Authoritative spawn is blocked or absent on ${this.mapId}`)
    this.player = await this.world.addPlayer(spawn)
    if (this.player.id !== ACTOR_ID || !this.player.base) throw new Error('Authoritative actor failed to load')
    const containerPolicy = entity => {
      const state = this.containers.states.get(entity.sourcePath)
      return state && this.containers.present(state) ? this.containers.policy(state) :
        { code: 'UNSUPPORTED_CONTAINER', message: 'Container was not verified for item transfers' }
    }
    this.ownership = new InventoryOwnership(this.map, this.player, { containerPolicy, canAccessContainer: (entity, actor) => {
      const state = this.containers.states.get(entity.sourcePath)
      return state && this.containers.present(state) ? this.containers.access(state, actor) :
        { code: 'UNSUPPORTED_CONTAINER', message: 'Container was not verified for item transfers' }
    } })
    this.ground = new GroundInteractions(this.map, this.ownership)
    // Authored declarative rules affect simulation and belong in the content
    // fingerprint. A missing optional file is safe only with no opted-in NPCs.
    const progressionRules = await loadOptionalRules(this.assetLoader, dataPath, 'rules/Progression.json', 16384)
    this.progression = new CharacterProgression(this.player, progressionRules)
    const conversationRules = await loadOptionalRules(this.assetLoader, dataPath, 'rules/Conversations.json', 1024 * 1024)
    this.conversations = new ConversationInteractions(this.map, this.ownership, conversationRules, { progression: this.progression })
    if (this.world.entityManager.systems.size !== 0) throw new Error('Headless host activated legacy systems')
    this.contentIdentity = capture.finish(this.mapId)
    // Names are private presentation only. Text edits must not invalidate an
    // otherwise compatible ownership checkpoint, and never hot-reload rules.
    this.itemDisplay = await loadItemDisplayCatalog(dataPath)
  }

  async start() {
    if (this.started || this.stopped) throw new Error('Authority server cannot be started twice')
    try {
      await this.loadWorld()
      this.httpServer = http.createServer((_request, response) => {
        response.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
        response.end('Not found\n')
      })
      this.io = new Server(this.httpServer, { serveClient: false, maxHttpBufferSize: 4096,
        transports: ['websocket', 'polling'], connectionStateRecovery: false })
      this.io.use((socket, next) => {
        let code
        const auth = socket.handshake.auth
        if (auth?.version !== PROTOCOL_VERSION) code = 'VERSION_MISMATCH'
        else if (tokenMatches(auth.token, this.ownerToken)) socket.data.role = 'owner'
        else if (tokenMatches(auth.token, this.observerToken)) socket.data.role = 'observer'
        else code = 'UNAUTHORIZED'
        if (code) {
          const error = new Error(code === 'UNAUTHORIZED' ? 'Invalid local session token' : 'Unsupported authority protocol version')
          error.data = { code }
          return next(error)
        }
        next()
      })
      this.io.on('connection', socket => this.onConnection(socket))
      await new Promise((resolve, reject) => {
        this.httpServer.once('error', reject)
        this.httpServer.listen(this.options.port, '127.0.0.1', () => {
          this.httpServer.off('error', reject)
          resolve()
        })
      })
      this.started = true
      this.revision++
      this.timer = setInterval(() => this.advanceMovement(performance.now()), this.options.tickMs)
      const port = this.httpServer.address().port
      return { host: '127.0.0.1', port, url: `http://127.0.0.1:${port}`,
        version: PROTOCOL_VERSION, mapId: this.mapId,
        ownerToken: this.ownerToken, observerToken: this.observerToken }
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  onConnection(socket) {
    socket.data.joined = false
    socket.on('disconnect', () => this.conversations?.invalidate(socket))
    socket.on('authority:join', (request, acknowledge) => {
      if (typeof acknowledge !== 'function') return
      if (!request || request.version !== PROTOCOL_VERSION) {
        acknowledge(this.reject(null, 'VERSION_MISMATCH', 'Unsupported authority protocol version'))
        return
      }
      socket.data.joined = true
      socket.join('authority:joined')
      acknowledge({ ok: true, version: PROTOCOL_VERSION, role: socket.data.role,
        mapId: this.mapId, actorId: ACTOR_ID, nextCommandId: this.lastCommandId + 1,
        snapshot: this.getSnapshot() })
    })
    socket.on('authority:command', async (command, acknowledge) => {
      if (typeof acknowledge !== 'function') return
      let result
      try { result = await this.command(socket, command) }
      catch (error) {
        console.error('Authority command failed:', error.message)
        result = this.reject(command?.id, 'INTERNAL_ERROR', 'Host could not process command')
      }
      acknowledge(result)
    })
  }

  reject(id, code, message) {
    return { ok: false, version: PROTOCOL_VERSION,
      id: Number.isSafeInteger(id) && id > 0 ? id : null,
      code, message, reason: message, revision: this.revision }
  }

  command(socket, command) {
    if (this.stopped) return this.reject(command?.id, 'SERVER_STOPPED', 'The local server has stopped')
    if (!socket.data.joined) return this.reject(command?.id, 'NOT_JOINED', 'Join the local session before submitting a command')
    if (!command || command.version !== PROTOCOL_VERSION) return this.reject(command?.id, 'VERSION_MISMATCH', 'Unsupported authority protocol version')
    if (socket.data.role !== 'owner' || command.actorId !== ACTOR_ID) {
      return this.reject(command.id, 'FORBIDDEN', 'This session cannot control that actor')
    }
    const move = command.type === 'move'
    const use = command.type === 'use'
    const inspect = command.type === 'inspect'
    const take = command.type === 'take'
    const put = command.type === 'put'
    const takeAll = command.type === 'take-all'
    const transfer = take || put || takeAll
    const drop = command.type === 'drop', pickup = command.type === 'pickup', groundTransfer = drop || pickup
    const inventory = command.type === 'inventory'
    const talk = command.type === 'talk', reply = command.type === 'reply', journal = command.type === 'journal'
    const character = command.type === 'character'
    const purchase = command.type === 'buy-attribute'
    const checkpoint = command.type === 'save' || command.type === 'load'
    const pause = command.type === 'pause' || command.type === 'resume'
    const allowed = ['version', 'id', 'actorId', 'type', ...(move ? ['target'] : drop ? ['itemId', 'expectedRevision'] : pickup ? ['targetId', 'expectedRevision'] : takeAll ? ['targetId', 'expectedRevision'] :
      transfer ? ['targetId', 'itemId', 'expectedRevision'] :
      reply ? ['targetId', 'conversationId', 'optionId', 'expectedRevision'] : purchase ? ['statId', 'expectedRevision'] : use || inspect || talk ? ['targetId'] : [])]
    if ((!move && !use && !inspect && !transfer && !groundTransfer && !inventory && !checkpoint && !pause && !talk && !reply && !journal && !character && !purchase) || !Number.isSafeInteger(command.id) || command.id < 1 ||
        (move && (!Array.isArray(command.target) || command.target.length !== 2 ||
          !command.target.every(Number.isSafeInteger))) ||
        ((use || inspect || transfer || pickup || talk || reply) && (typeof command.targetId !== 'string' || !command.targetId || command.targetId.length > 1024)) ||
        (reply && (typeof command.conversationId !== 'string' || !command.conversationId || command.conversationId.length > 128 ||
          typeof command.optionId !== 'string' || !command.optionId || command.optionId.length > 128 ||
          !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) ||
        (purchase && (!ATTRIBUTE_IDS.includes(command.statId) || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) ||
        (drop && (typeof command.itemId !== 'string' || !command.itemId || command.itemId.length > 1024)) ||
        (groundTransfer && (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) ||
        (transfer && ((!takeAll && (typeof command.itemId !== 'string' || !command.itemId || command.itemId.length > 1024)) ||
          !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) || !exactKeys(command, allowed)) {
      return this.reject(command.id, 'INVALID_COMMAND', 'Expected a supported intention with a positive integer id and its exact fields')
    }
    if (command.id <= this.lastCommandId) return this.reject(command.id, 'REPLAYED_COMMAND', 'Command id has already been consumed')
    this.lastCommandId = command.id
    if (this.checkpointBusy) return this.reject(command.id, 'BUSY', 'A checkpoint operation is already in progress')
    if (pause) return this.setPaused(command)
    if (this.paused && !checkpoint && !inventory && !journal && !character) return this.reject(command.id, 'PAUSED', 'The local game is paused')
    if (this.movement) return this.reject(command.id, 'BUSY', 'The actor is already moving')
    if (checkpoint) return this.checkpoint(command)
    if (inventory) return this.inspectInventory(command)
    if (journal) return this.inspectJournal(command)
    if (character) return this.inspectCharacter(command)
    if (purchase) return this.buyAttribute(command)
    if (talk || reply) return this.converse(socket, command)
    if (groundTransfer) return this.transferGroundItem(command)
    if (transfer) return this.transferItem(command)
    if (inspect) return this.inspectContainer(command)
    if (use) return this.useTarget(command)
    const [x, y] = command.target
    if (x < 0 || y < 0 || x >= this.map.width * Sector.Width || y >= this.map.height * Sector.Height) {
      return this.reject(command.id, 'OUT_OF_BOUNDS', 'Destination is outside the map')
    }
    const origin = this.player.base.location
    if (x === origin.x && y === origin.y) {
      const result = { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
        status: 'completed', path: [[x, y]] }
      this.lastCommand = { id: command.id, status: 'completed' }
      this.conversations?.invalidate()
      this.publish()
      return { ...result, revision: this.revision }
    }
    if (this.map.isTileBlocked(x, y)) return this.reject(command.id, 'BLOCKED', 'Destination is blocked, empty or unloaded')
    const path = this.map.pathFind.findPath(origin, new Location(x, y))
      .map(point => [point.x, point.y])
    if (path.length < 2) return this.reject(command.id, 'NO_PATH', 'No walkable path reaches the destination')
    this.movement = { commandId: command.id, path, index: 0, elapsedMs: 0,
      durationMs: STEP_DURATION_MS, startedAt: performance.now() }
    this.conversations?.invalidate()
    this.lastCommand = { id: command.id, status: 'accepted' }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'accepted', path: path.map(point => [...point]), revision: this.revision }
  }

  useTarget(command) {
    const interactions = this.doors.states.has(command.targetId) ? this.doors :
      this.ownership.items.get(command.targetId)?.groundCapable ? this.ground :
        this.conversations?.targets.has(command.targetId) ? this.conversations : this.containers
    const prepared = interactions.prepare(command.targetId, this.player)
    if (prepared.code) return this.reject(command.id, prepared.code, prepared.message)
    const { path, pending } = prepared
    const record = { id: command.id, type: 'use', targetId: command.targetId }
    if (path.length === 1) {
      const applied = interactions.apply(pending, this.player)
      if (applied.code) return this.reject(command.id, applied.code, applied.message)
      this.conversations?.invalidate()
      this.lastCommand = { ...record, status: 'completed', result: applied.result }
      this.publish()
      return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
        status: 'completed', targetId: command.targetId, path, result: applied.result, revision: this.revision }
    }
    this.movement = { commandId: command.id, path, index: 0, elapsedMs: 0,
      durationMs: STEP_DURATION_MS, startedAt: performance.now(), pendingUse: pending,
      pendingUseKind: interactions === this.containers ? 'container' : interactions === this.ground ? 'ground' :
        interactions === this.conversations ? 'conversation' : 'door' }
    this.conversations?.invalidate()
    this.lastCommand = { ...record, status: 'accepted' }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'accepted', targetId: command.targetId, path: path.map(point => [...point]), revision: this.revision }
  }

  inspectContainer(command) {
    const inspected = this.containers.inspect(command.targetId, this.player)
    if (inspected.code) return this.reject(command.id, inspected.code, inspected.message)
    // Contents travel only in this owner's acknowledgement. Public snapshots,
    // including later joins and observers, retain a summary without item data.
    const summary = { kind: 'container', targetId: command.targetId }
    this.conversations?.invalidate()
    this.lastCommand = { id: command.id, type: 'inspect', targetId: command.targetId, status: 'completed', result: summary }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', targetId: command.targetId, result: this.privateItemResult(inspected.result), revision: this.revision }
  }

  inspectInventory(command) {
    const inventory = this.ownership.actorInventory()
    if (inventory.code) return this.reject(command.id, inventory.code, inventory.message)
    // A private read consumes its command id without invalidating inspected
    // revisions or replacing another client's public completion record.
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', result: this.privateItemResult({ kind: 'inventory', ...inventory }), revision: this.revision }
  }

  inspectJournal(command) {
    try {
      return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
        status: 'completed', result: { kind: 'journal', ...this.conversations.journal(), character: this.progression.view() }, revision: this.revision }
    } catch (_) { return this.reject(command.id, 'QUEST_UNAVAILABLE', 'The quest journal could not be safely read') }
  }

  inspectCharacter(command) {
    try {
      return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
        status: 'completed', result: this.progression.view(), revision: this.revision }
    } catch (_) { return this.reject(command.id, 'PROGRESSION_UNAVAILABLE', 'Character progression could not be safely read') }
  }

  buyAttribute(command) {
    if (command.expectedRevision !== this.revision) {
      return this.reject(command.id, 'STALE_REVISION', 'The character view changed; refresh it before purchasing')
    }
    let transaction, character
    try {
      transaction = prepareOwnWrites(this.progression.purchaseWrites(command.statId))
      transaction.apply()
      character = this.progression.view()
    } catch (failure) {
      transaction?.rollback()
      const code = ['INSUFFICIENT_POINTS', 'ATTRIBUTE_AT_MAX', 'PROGRESSION_UNAVAILABLE'].includes(failure.code) ?
        failure.code : 'PROGRESSION_UNAVAILABLE'
      return this.reject(command.id, code, code === 'INSUFFICIENT_POINTS' ? 'Not enough Character Points.' :
        code === 'ATTRIBUTE_AT_MAX' ? 'Attribute is at its maximum.' : 'Character progression could not be safely updated')
    }
    this.conversations.invalidate()
    // Attribute choices, balances and derived values stay in the owner's ACK.
    this.lastCommand = { id: command.id, type: 'buy-attribute', status: 'completed', result: { kind: 'buy-attribute' } }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID, status: 'completed',
      result: { kind: 'buy-attribute', statId: command.statId, character }, revision: this.revision }
  }

  converse(socket, command) {
    if (command.type === 'reply' && command.expectedRevision !== this.revision) {
      return this.reject(command.id, 'STALE_REVISION', 'The world changed; speak to the NPC again')
    }
    let outcome
    try {
      outcome = command.type === 'talk' ? this.conversations.talk(command.targetId, socket, this.player) :
        this.conversations.reply(command, socket, this.player)
    } catch (_) {
      this.conversations.invalidate()
      return this.reject(command.id, 'QUEST_UNAVAILABLE', 'The conversation could not be safely read')
    }
    if (outcome.code) return this.reject(command.id, outcome.code, outcome.message)
    if (outcome.changed) {
      // A reply's effects and held-item conditions remain owner-private. Public
      // completion cannot reveal the journal, choices or inventory possession.
      this.lastCommand = { id: command.id, type: 'reply', status: 'completed', result: { kind: 'reply' } }
      this.publish()
    }
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', result: outcome.result, revision: this.revision }
  }

  privateItemResult(result) {
    // Ownership validation, approach signatures and the immutable ledger retain
    // their generic rows. Only the requesting owner's ACK receives these names.
    const rows = items => items.map(row => ({ ...row,
      label: this.itemDisplay?.labelFor(this.ownership.items.get(row.id)?.entity, row.label) || row.label,
      ...(this.ownership.canDrop(row.id) ? { canDrop: true } : {}) }))
    return { ...result, ...(Array.isArray(result.items) ? { items: rows(result.items) } : {}),
      ...(result.ground ? { ground: this.groundDescriptor(result.ground) } : {}),
      ...(result.inventory ? { inventory: { ...result.inventory, items: rows(result.inventory.items) } } : {}) }
  }

  groundDescriptor(row) {
    return { ...row, label: this.itemDisplay?.labelFor(this.ownership.items.get(row.id)?.entity, row.label) || row.label }
  }

  transferGroundItem(command) {
    if (command.expectedRevision !== this.revision) {
      return this.reject(command.id, 'STALE_REVISION', 'The world changed; inspect the current state again')
    }
    const transferred = command.type === 'drop' ? this.ownership.drop(command.itemId) : this.ownership.pickup(command.targetId)
    if (transferred.code) return this.reject(command.id, transferred.code, transferred.message)
    this.conversations?.invalidate()
    // A picked-up identity stops being public in the same committed snapshot.
    // Drop reveals only the item that now visibly exists on the floor.
    this.lastCommand = { id: command.id, type: command.type, status: 'completed',
      result: { kind: command.type, ...(command.type === 'drop' ? { targetId: command.itemId } : {}) } }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', result: this.privateItemResult(transferred.result), revision: this.revision }
  }

  transferItem(command) {
    if (command.expectedRevision !== this.revision) {
      return this.reject(command.id, 'STALE_REVISION', 'The inspected world changed; inspect the container again')
    }
    const inspected = this.containers.inspect(command.targetId, this.player)
    if (inspected.code) return this.reject(command.id, inspected.code, inspected.message)
    const state = this.containers.states.get(command.targetId)
    const transferred = command.type === 'take-all' ? this.ownership.takeAll(state.entity) : this.ownership[command.type](state.entity, command.itemId)
    if (transferred.code) return this.reject(command.id, transferred.code, transferred.message)
    this.conversations?.invalidate()
    // Item ids, counts and contents never enter public state or late joins.
    this.lastCommand = { id: command.id, type: command.type, targetId: command.targetId, status: 'completed',
      result: { kind: command.type, targetId: command.targetId } }
    this.publish()
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', targetId: command.targetId, result: this.privateItemResult(transferred.result), revision: this.revision }
  }

  setPaused(command) {
    if (!this.options.allowPause) return this.reject(command.id, 'PAUSE_UNAVAILABLE', 'This host does not allow pausing')
    this.conversations?.invalidate()
    const paused = command.type === 'pause'
    if (paused !== this.paused) {
      const now = performance.now()
      if (paused) {
        // Commit all progress through this instant, including an interaction
        // that genuinely completes before the pause. Later ticks are frozen.
        this.advanceMovement(now)
        this.pausedAt = now
      } else {
        if (this.movement) this.movement.startedAt += Math.max(0, now - this.pausedAt)
        this.pausedAt = null
      }
      this.paused = paused
      this.publish()
    }
    // A pause command must not replace the active movement's completion record.
    // Owners observe this separate capability/state and the private ACK instead.
    return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
      status: 'completed', result: { kind: command.type, paused: this.paused }, revision: this.revision }
  }

  createCheckpoint() {
    let ownership, quests, character
    try {
      ownership = this.ownership.checkpointStates()
      quests = this.conversations.checkpointStates()
      character = this.progression.checkpointState()
    }
    catch (_) { throw checkpointError('CHECKPOINT_INVALID') }
    return { format: CHECKPOINT_FORMAT, version: 6, rulesVersion: RULES_VERSION,
      mapId: this.mapId, contentIdentity: this.contentIdentity, savedAt: new Date().toISOString(),
      actor: { id: ACTOR_ID, location: [this.player.base.location.x, this.player.base.location.y] },
      doors: this.doors.checkpointStates(), ownership, quests, character }
  }

  validateCheckpoint(document) {
    if (document?.format === CHECKPOINT_FORMAT && [1, 2, 3, 4, 5].includes(document.version)) throw checkpointError('CHECKPOINT_INCOMPATIBLE')
    if (!exactKeys(document, ['format', 'version', 'rulesVersion', 'mapId', 'contentIdentity', 'savedAt', 'actor', 'doors', 'ownership', 'quests', 'character']) ||
        typeof document.savedAt !== 'string' || !Number.isFinite(Date.parse(document.savedAt)) ||
        new Date(document.savedAt).toISOString() !== document.savedAt ||
        !exactKeys(document.actor, ['id', 'location']) || document.actor.id !== ACTOR_ID ||
        !Array.isArray(document.actor.location) || document.actor.location.length !== 2 ||
        !document.actor.location.every(Number.isSafeInteger) ||
        typeof document.contentIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(document.contentIdentity)) {
      throw checkpointError('CHECKPOINT_INVALID')
    }
    if (document.format !== CHECKPOINT_FORMAT || document.version !== 6 ||
        document.rulesVersion !== RULES_VERSION || document.contentIdentity !== this.contentIdentity || document.mapId !== this.mapId) {
      throw checkpointError('CHECKPOINT_INCOMPATIBLE')
    }
    const doors = this.doors.validateCheckpoint(document.doors)
    if (doors.code) throw checkpointError(doors.code)
    let ownership, quests, progression
    try {
      ownership = this.ownership.validateCheckpoint(document.ownership)
      quests = this.conversations.validateCheckpoint(document.quests)
      progression = prepareOwnWrites(this.progression.checkpointWrites(document.character, document.quests))
    }
    catch (_) { throw checkpointError('CHECKPOINT_INVALID') }
    const [x, y] = document.actor.location
    if (x < 0 || y < 0 || x >= this.map.width * Sector.Width || y >= this.map.height * Sector.Height ||
        this.checkpointLocationBlocked(x, y, doors.candidate)) throw checkpointError('CHECKPOINT_INVALID')
    return { location: new Location(document.actor.location), doors: doors.candidate, ownership, quests, progression }
  }

  checkpointLocationBlocked(x, y, candidateDoors) {
    const tile = this.map.getTile(x, y)
    if (!tile?.type || tile.blocked) return true
    // Inspect the candidate without editing live collision state or moving the
    // player temporarily. The current player occupancy is replaced on load.
    for (const entity of this.map.entityManager.entities.values()) {
      if (entity === this.player || entity.map !== this.map || !entity.base ||
          entity.base.location.x !== x || entity.base.location.y !== y ||
          !['Wall', 'Portal', 'Npc', 'Pc', 'Scenery', 'Container'].includes(entity.base.type) ||
          entity.base.flags.hasAny(['Inventory', 'Off', 'Destroyed'])) continue
      const door = this.doors.states.get(entity.sourcePath)
      if (entity.base.type === 'Portal' && door?.artSupported && candidateDoors.has(door.id)) {
        if (candidateDoors.get(door.id)) continue
        return true
      }
      if (!entity.base.flags.has('NoBlock')) return true
    }
    return false
  }

  applyCheckpoint(candidate) {
    const origin = new Location(this.player.base.location.x, this.player.base.location.y)
    const sourceTile = this.map.getTile(origin.x, origin.y)
    const targetTile = this.map.getTile(candidate.location.x, candidate.location.y)
    const sourcePlayers = sourceTile?.Pc
    if (!sourcePlayers || sourcePlayers[ACTOR_ID] !== this.player) throw checkpointError('CHECKPOINT_INVALID')
    let doors
    try {
      const values = []
      for (const [id, open] of candidate.doors) {
        const state = this.doors.states.get(id)
        values.push([state, 'open', open])
        if (state.artSupported) values.push([state.entity, 'portalOpen', open])
      }
      doors = prepareOwnWrites(values)
    } catch (_) { throw checkpointError('CHECKPOINT_INVALID') }
    let targetPlayers
    if (!origin.equals(candidate.location)) {
      targetPlayers = targetTile?.Pc
      // Legacy movement deletes the old tile entry before inserting the new
      // one. Preflight both writes before committing any door or actor state.
      const targetDescriptor = targetTile && Object.getOwnPropertyDescriptor(targetTile, 'Pc')
      if (!Object.isExtensible(sourcePlayers) || Object.getOwnPropertyDescriptor(sourcePlayers, ACTOR_ID)?.configurable !== true ||
          !targetTile || (targetPlayers !== undefined &&
            (!targetPlayers || typeof targetPlayers !== 'object' || Array.isArray(targetPlayers) ||
              !Object.isExtensible(targetPlayers) || Object.hasOwn(targetPlayers, ACTOR_ID))) ||
          (targetPlayers === undefined && (!Object.isExtensible(targetTile) ||
            (targetDescriptor && (!targetDescriptor.writable || !targetDescriptor.configurable))))) {
        throw checkpointError('CHECKPOINT_INVALID')
      }
    }
    try {
      if (!origin.equals(candidate.location)) {
        this.map.moveEntity(this.player, origin, candidate.location)
        this.player.base.location.set([candidate.location.x, candidate.location.y])
      }
      candidate.ownership.apply()
      doors.apply()
      candidate.quests.apply()
      candidate.progression.apply()
    } catch (_) {
      candidate.progression.rollback()
      candidate.quests.rollback()
      doors.rollback()
      candidate.ownership.rollback()
      if (!origin.equals(candidate.location)) {
        // Sector event hooks can throw synchronously. Restore just this actor's
        // occupancy without emitting another hook or exposing a partial load.
        sourcePlayers[ACTOR_ID] = this.player
        if (targetPlayers === undefined) delete targetTile.Pc
        else delete targetPlayers[ACTOR_ID]
        this.player.base.location.set([origin.x, origin.y])
      }
      throw checkpointError('CHECKPOINT_INVALID')
    }
  }

  async checkpoint(command) {
    const kind = command.type
    this.conversations?.invalidate()
    this.checkpointBusy = true
    this.checkpointState = { supported: true, busy: true, lastAction: kind,
      ...(this.checkpointState.savedAt ? { savedAt: this.checkpointState.savedAt } : {}) }
    this.publish()
    try {
      let document
      if (kind === 'save') {
        // Capture once before awaiting disk IO; mutation commands are blocked
        // until the operation completes, independent of client connectivity.
        document = this.createCheckpoint()
        await this.checkpointStore.write(document)
      } else {
        document = await this.checkpointStore.read()
        if (this.stopped) return this.reject(command.id, 'SERVER_STOPPED', 'The local server has stopped')
        const candidate = this.validateCheckpoint(document)
        // Validation above has no side effects. Applying the validated state is
        // synchronous, so no tick/socket can observe a partially restored world.
        this.applyCheckpoint(candidate)
      }
      if (this.stopped) return this.reject(command.id, 'SERVER_STOPPED', 'The local server has stopped')
      const result = { kind, savedAt: document.savedAt }
      this.lastCommand = { id: command.id, type: kind, status: 'completed', result }
      this.checkpointBusy = false
      this.checkpointState = { supported: true, busy: false, lastAction: kind, savedAt: document.savedAt }
      this.publish()
      return { ok: true, version: PROTOCOL_VERSION, id: command.id, actorId: ACTOR_ID,
        status: 'completed', result, revision: this.revision }
    } catch (failure) {
      if (this.stopped) return this.reject(command.id, 'SERVER_STOPPED', 'The local server has stopped')
      const code = Object.hasOwn(CHECKPOINT_ERRORS, failure?.code) ? failure.code : 'CHECKPOINT_IO_ERROR'
      const message = CHECKPOINT_ERRORS[code]
      this.checkpointBusy = false
      this.checkpointState = { ...this.checkpointState, busy: false, error: { code, message } }
      this.publish()
      return this.reject(command.id, code, message)
    }
  }

  advanceMovement(now) {
    const movement = this.movement
    if (!movement || this.stopped || this.paused) return
    const elapsed = Math.max(0, now - movement.startedAt)
    const reached = Math.min(movement.path.length - 1, Math.floor(elapsed / STEP_DURATION_MS))
    while (movement.index < reached) {
      const target = new Location(movement.path[movement.index + 1])
      if (this.map.isTileBlocked(target)) {
        this.lastCommand = { ...this.lastCommand, id: movement.commandId, status: 'interrupted',
          code: 'BLOCKED', message: 'The route became blocked during movement' }
        this.movement = null
        this.publish()
        return
      }
      const origin = new Location(this.player.base.location.x, this.player.base.location.y)
      this.map.moveEntity(this.player, origin, target)
      this.player.base.location.set([target.x, target.y])
      movement.index++
    }
    if (movement.index >= movement.path.length - 1) {
      this.movement = null
      if (movement.pendingUse) {
        const interactions = movement.pendingUseKind === 'container' ? this.containers : movement.pendingUseKind === 'ground' ? this.ground :
          movement.pendingUseKind === 'conversation' ? this.conversations : this.doors
        const applied = interactions.apply(movement.pendingUse, this.player)
        this.lastCommand = applied.code ? { ...this.lastCommand, status: 'interrupted',
          code: applied.code, message: applied.message } :
          { ...this.lastCommand, status: 'completed', result: applied.result }
      } else this.lastCommand = { id: movement.commandId, status: 'completed' }
    } else movement.elapsedMs = elapsed - movement.index * STEP_DURATION_MS
    this.publish()
  }

  getSnapshot() {
    if (!this.player) return null
    const movement = this.movement
    return { version: PROTOCOL_VERSION, mapId: this.mapId, revision: this.revision,
      serverTime: Date.now(), pause: { supported: this.options.allowPause, paused: this.paused }, checkpoint: { ...this.checkpointState,
        ...(this.checkpointState.error ? { error: { ...this.checkpointState.error } } : {}) },
      doors: this.doors?.snapshots() || [], containers: this.containers?.snapshots() || [],
      conversationTargets: this.conversations?.snapshots() || [],
      groundItems: this.ownership?.groundItems().map(row => this.groundDescriptor(row)) || [], actors: [{ id: ACTOR_ID,
        location: [this.player.base.location.x, this.player.base.location.y],
        movement: movement ? { commandId: movement.commandId,
          path: movement.path.map(point => [...point]), index: movement.index,
          elapsedMs: movement.elapsedMs, durationMs: movement.durationMs,
          progress: movement.index + movement.elapsedMs / movement.durationMs } : null,
        lastCommand: this.lastCommand ? { ...this.lastCommand,
          ...(this.lastCommand.result ? { result: { ...this.lastCommand.result } } : {}) } : null }] }
  }

  publish() {
    this.revision++
    this.io?.to('authority:joined').emit('authority:snapshot', this.getSnapshot())
  }

  stop() {
    if (this._stopPromise) return this._stopPromise
    this.stopped = true
    clearInterval(this.timer)
    this.timer = null
    this.movement = null
    this._stopPromise = (async () => {
      if (this.io) await new Promise(resolve => this.io.close(resolve))
      else if (this.httpServer?.listening) await new Promise(resolve => this.httpServer.close(resolve))
      if (this.assetLoader) {
        await Promise.all(this.assetLoader.archives.map(archive => new Promise(resolve => archive.close(() => resolve()))))
        this.assetLoader.archives.length = 0
        this.assetLoader.archiveEntries?.clear()
      }
      this.engine?.events.removeAllListeners()
      this.doors?.clear()
      this.containers?.clear()
      this.conversations?.clear()
      this.progression?.clear()
      this.ownership?.clear()
      this.itemDisplay = null
      this.world?.entityManager.entities.clear()
      this.world?.entityManager.dynamicEntities.clear()
      if (globalThis.AGate === this.core) {
        if (this.previousAGate === undefined) delete globalThis.AGate
        else globalThis.AGate = this.previousAGate
        if (this.previousLog === undefined) delete globalThis.lll
        else globalThis.lll = this.previousLog
        if (this.previousErrorLog === undefined) delete globalThis.lle
        else globalThis.lle = this.previousErrorLog
      }
    })()
    return this._stopPromise
  }
}

export function createAuthorityServer(options) {
  return new AuthorityServer(options)
}
