import ClientScriptEngine from '../shared/scripting/ClientScriptEngine'
import NodeScriptLoader from '../shared/scripting/NodeScriptLoader'
import { defineScript, type ClientScriptDefinition, type ScriptPresentation } from '../shared/scripting/ScriptApi'
import type { AuthorityPresentation, ScriptMessageState, ScriptObjectState } from './ClientScriptTypes'
import type { AssetDescriptor, AssetTarget } from '../shared/assets/AssetLoader'
import type ClientMap from './Map'
import type Visual from '../shared/entity/components/Visual'
import type { VisualClass } from '../shared/entity/components/Visual'
import type Sprite from './Sprite'
import type Entity from '../shared/entity/Entity'
import type { AuthoritySession, AuthoritySnapshot, PrivateItem, GroundItem, MovementCompletion, PendingMovement, OfflineMovement, InteractionState, ResponsePayload, InventoryState, ActionRequest, InventoryRequest, CheckpointPending, PausePending, ActionState, PauseState, CheckpointCompletion, PauseCompletion, InteractionTarget } from './ClientTypes'
import type { CharacterState, CharacterRequest, ConversationState, ConversationRequest, JournalState, JournalRequest, SessionClient } from './SessionTypes'
import { errorCode } from './ClientTypes'
import { privateItems, readCarryingState } from './PrivateInventory'
import { isRecord, isInteger, errorMessage } from './SessionTypes'
import type GameEngine from '../shared/GameEngine'
import type GameMap from '../shared/map/GameMap'
import type AssetLoader from '../shared/assets/AssetLoader';
import type EventEmitter from '../shared/misc/EventEmitter';

import ClientNetwork from './network/ClientNetwork'
import AuthorityClient from './network/AuthorityClient'
import ConversationSession from './ConversationSession'
import CharacterSession from './CharacterSession'
import Scene from './Scene'
import World from './World'
import Location from '../shared/Location'
import Manager from './Gui'
import Renderer from './Renderer'
import Utils from './Utils'
import EntityUtils from '../shared/entity/Utils'

import GfxPathBuilder from '../shared/assets/GfxPathBuilder';
import Player from '../shared/player/Player'
import StepState from '../shared/StepState';
import * as PlayerLogic from './logic/player'

const defaultPresentation = defineScript({ apiVersion: 1, id: 'openarcanum:presentation', name: 'Private script messages', realm: 'client',
  entryPoints: { 0(context) {
    if (context.event.type === 'message' && typeof context.event.text === 'string') {
      context.ui.message(context.event.text, typeof context.event.targetId === 'string' ? context.event.targetId : undefined)
    }
  } }
})

type RenderedPlayer = Entity & { visual: Visual & { classes: Record<string, VisualClass> & { current: VisualClass & { sprite: Sprite } } } }


function groundItems(rows: unknown): GroundItem[] {
  const ids = new Set()
  if (!Array.isArray(rows) || rows.length > 1024) throw new Error('Local server supplied invalid ground items')
  return rows.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 1024 || ids.has(item.id) ||
        item.kind !== 'ground' || item.type !== 'Generic' || typeof item.label !== 'string' || !item.label ||
        item.label.length > 128 || !Number.isSafeInteger(item.prototypeId) || item.prototypeId < 1 ||
        !Array.isArray(item.location) || item.location.length !== 2 || !item.location.every(Number.isSafeInteger)) {
      throw new Error('Local server supplied invalid ground items')
    }
    ids.add(item.id)
    return { id: item.id, kind: 'ground', label: item.label, type: item.type,
      prototypeId: item.prototypeId, location: [...item.location] as [number, number] }
  })
}

export default class ClientEngine extends ClientNetwork {
  private scriptRuntime?: ClientScriptEngine
  private scriptLoader?: NodeScriptLoader
  private scriptPrograms: ClientScriptDefinition[] = []
  private scriptPacket?: AuthorityPresentation
  declare scriptEpoch?: number
  scriptMessage: ScriptMessageState | null = null
  scriptObjects = new Map<string, boolean>()
  scriptVisualReady: Promise<unknown> = Promise.resolve()
  private scriptSpriteLoads = new Map<Entity, Promise<unknown>>()
  private scriptSpriteState = new WeakMap<object, { visible: boolean; renderable: boolean; eventMode: Sprite['iso']['eventMode'] }>()
  declare ready: boolean
  declare runtimeError: string | null
  declare checkpointRequest: ActionRequest | null
  declare checkpointPending: CheckpointPending | null
  declare checkpointState: ActionState | null
  declare pauseRequest: ActionRequest | null
  declare pausePending: PausePending | null
  declare pauseState: PauseState | null
  declare inventoryState: InventoryState | null
  declare inventoryEpoch: number
  declare inventoryRequest: InventoryRequest | null
  declare transferRequest: ActionRequest | null
  declare groundRequest: ActionRequest | null
  declare groundState: ActionState | null
  declare conversationState: ConversationState | null
  declare journalState: JournalState | null
  declare conversationRequest: ConversationRequest | null
  declare journalRequest: JournalRequest | null
  declare characterState: CharacterState | null
  declare characterRequest: CharacterRequest | null
  declare authority: AuthorityClient
  declare world: World
  declare map: ClientMap
  declare movement: PendingMovement | null
  declare stopped: boolean
  declare interactionState: InteractionState | null
  declare preparingMovement: boolean
  declare authorityLastPath: [number, number][] | null
  declare conversationSession: ConversationSession
  declare characterSession: CharacterSession
  declare ownershipRevision: number
  declare pauseSignature: string
  declare authorityDoorSignature: string
  declare authorityContainerSignature: string
  declare authorityGroundSignature: string
  declare groundVisualReady: Promise<void> | undefined
  declare authorityState: AuthoritySnapshot
  declare authorityReceivedAt: number
  declare ownershipCommandSignature: string
  declare authorityAnimation: string
  declare authorityVisualLoading: boolean
  declare authorityVisualReady: Promise<void> | undefined
  declare renderer: Renderer
  declare scene: Scene
  declare guiManager: Manager
  declare player: RenderedPlayer
  declare commandEvaluators: Map<string, Map<string, { onCommand(command: Record<string, unknown>): { action?: string; data?: unknown } }>>


  /**
   *
   * @param gameEngine
   * @param options
   * @param canvas
   */
  constructor(gameEngine: GameEngine, options: Record<string, unknown>) {
    options = Object.assign(
      {
        autoConnect: false
      },
      options
    )

    super(gameEngine, options)
    this.guiManager = new Manager(gameEngine)
    this.player = null!
    this.ready = false
    this.runtimeError = null
    this.checkpointRequest = null
    this.checkpointPending = null
    this.checkpointState = null
    this.pauseRequest = null
    this.pausePending = null
    this.pauseState = null
    this.inventoryState = null
    this.inventoryEpoch = 0
    this.inventoryRequest = null
    this.transferRequest = null
    this.groundRequest = null
    this.groundState = null
    this.conversationState = null
    this.journalState = null
    this.conversationRequest = null
    this.journalRequest = null
    this.characterState = null
    this.characterRequest = null

    this.events.on(`Map:Loading`, this.onMapLoading, this)
    this.events.on(`Map:Loaded`, this.onMapLoaded, this)
    this.events.on(`Scene:Created`, this.onSceneCreated, this)
    this.events.on(`Object:Click`, this.onObjectClick, this)
    this.events.on(`Object:Updated`, this.onObjectUpdated, this)
    this.events.on('Game:Start', this.onStartGame, this)

    this.commandEvaluators = new Map()

    //this.events.on(`player.command`, this.onPlayerCommand, this)

    this.addCommandEvaluators(`Player`, PlayerLogic)

  }

  async startLocalAuthority(mapId: string, session: AuthoritySession) {
    this.authority = new AuthorityClient(session, {
      onSnapshot: snapshot => this.applyAuthoritySnapshot(snapshot),
      onPresentation: event => this.receiveScriptPresentation(event),
      onError: error => this.onRuntimeError(error)
    })
    try {
      const joined = await this.authority.start()
      if (joined.mapId !== mapId) throw new Error('Local server loaded a different map')
      const actor = this.authority.snapshot!.actors.find(actor => actor.id === joined.actorId)
      if (!actor) throw new Error('Local server did not provide the controlled actor')
      await this.startOffline(mapId, actor.location)
      if (this.player.id !== joined.actorId) throw new Error('Controlled actor identity differs from the server')
      this.applyAuthoritySnapshot(this.authority.snapshot!)
      await this.groundVisualReady
      await this.scriptVisualReady
      await this.refreshInventory()
      await this.refreshJournal()
      return this
    } catch (error) {
      this.authority.close()
      throw error
    }
  }

  async startOffline(mapId: string, spawn: Array<number> | null | undefined) {
    this.assertStartupActive()
    if (!mapId) throw new Error('Offline startup requires a converted map ID')
    this.world = new World(this.gameEngine, { id: 'offline' })
    this.gameEngine.world = this.world
    await this.world.init({})
    this.assertStartupActive()
    this.map = await this.world.loadMap(mapId) as ClientMap
    this.assertStartupActive()
    await this.scene.mapReady
    this.assertStartupActive()
    const location = spawn ? new Location(spawn) : this.map.getStartLocation()
    if (!this.authority && this.map.isTileBlocked(location)) throw new Error('Converted map start tile is blocked')
    this.player = await this.world.addPlayer(location) as RenderedPlayer
    this.assertStartupActive()
    await this.scene.addEntity(this.player, this.map.objectGroup)
    this.assertStartupActive()
    this.scene.sortGroup(this.map.objectGroup)
    this.scene.setCameraLocation(location)
    await this.world.start()
    this.assertStartupActive()
    this.ready = true
    await this.start()
    this.assertStartupActive()
    this.events.emit('Player:Joined', this.player)
    return this
  }

  assertStartupActive() {
    if (this.stopped) throw new Error('Client stopped during startup')
  }

  onRuntimeError(failure: unknown) {
    const error = failure instanceof Error ? failure : new Error(errorMessage(failure))
    if (this.stopped) return
    this.runtimeError = errorMessage(error)
    this.ready = false
    if (this.movement) {
      this.movement.reject(error)
      this.movement = null
    }
    this.stop()
    this.events.emit('Game:Error', error)
    console.error(error)
  }

  stop() {
    this.stopped = true
    this.ready = false
    this.scriptMessage = null
    this.disposeClientScripts()
    this.scriptObjects?.clear()
    this.scriptSpriteLoads?.clear()
    this.events.emit('Player:ScriptMessage', null)
    this.conversationSession?.invalidate()
    this.conversationRequest = null
    this.journalRequest = null
    this.conversationState = null
    this.journalState = null
    this.characterState = null
    this.characterRequest = null
    if (this.interactionState?.kind === 'container') this.interactionState = null
    this.inventoryEpoch = (this.inventoryEpoch || 0) + 1
    this.inventoryState = null
    this.inventoryRequest = null
    this.transferRequest = null
    this.groundRequest = null
    this.groundState = null
    this.checkpointRequest = null
    this.authority?.close()
    if (this.checkpointPending) {
      this.checkpointPending.reject(new Error('Client stopped during checkpoint request'))
      this.checkpointPending = null
    }
    this.pauseRequest = null
    if (this.pausePending) {
      clearTimeout(this.pausePending.timer)
      this.pausePending.reject(new Error('Client stopped during pause request'))
      this.pausePending = null
    }
    if (this.scene) this.scene.stop()
    if (this.movement) {
      this.movement.reject(new Error('Client stopped during movement'))
      this.movement = null
    }
  }

  getDevelopmentState() {
    const map = this.map
    const sectors = map ? map.getActiveSectors() : []
    let tiles = 0, renderedTiles = 0, roofs = 0, roofRows = 0, lights = 0, renderedEntities = 0
    let renderedRoofs = 0, visibleRoofs = 0
    for (const sector of sectors) {
      sector.inspectTiles((value: unknown) => {
        const tile = value as import('./RenderTypes').RenderedTile | undefined
        if (tile && tile.type) tiles++
        if (tile && tile.sprite && tile.sprite.iso.parent) renderedTiles++
      })
      roofRows += sector.roofs ? sector.roofs.length : 0
      roofs += sector.roofs ? sector.roofs.flat().filter(roof => roof != null).length : 0
      for (const roof of (sector.roofs as unknown as Array<import('./RenderTypes').RoofData[]>)?.flat() || []) {
        if (roof?.sprite?.iso.parent) {
          renderedRoofs++
          if (roof.sprite.iso.visible) visibleRoofs++
        }
      }
      lights += sector.lights ? sector.lights.length : 0
    }
    const duplicateSourceIds = []
    if (this.world) {
      for (const entity of this.world.entityManager.entities.values()) {
        const visual = entity.visual && entity.visual.classes.current
        if (visual && visual.sprite && visual.sprite.iso.parent) renderedEntities++
        if (entity.sourceId) duplicateSourceIds.push(entity.sourceId)
      }
    }
    const sprite = this.player && this.player.visual.classes.current.sprite
    const center = this.scene && this.scene.renderer.viewport.center
    const interaction = this.interactionState ? { ...this.interactionState,
      ...(this.interactionState.items ? { items: this.interactionState.items.map( (item)=>({...item}))}:{})}:null
    return {
      ready: this.ready, running: this.ready && !this.scene.stopped,
      frameCount: this.scene ? this.scene.frameCount : 0,
      error: this.runtimeError ||( this.scene && this.scene.error),
      map: map ? { id: map.id, width: map.width, height: map.height } : null,
      sectors: sectors.length, tiles, renderedTiles,
      entities: this.world ? this.world.entityManager.entities.size : 0,
      prototypes: this.world ? this.world.entityManager.prototypes.size : 0,
      renderedEntities, duplicateSourceIds, roofs, roofRows, renderedRoofs, visibleRoofs, lights,
      lighting: this.scene?.lightLayer?.diagnostics || null,
      lightingAvailable: !!map?.lighting,
      authority: this.authority ? {
        mode: 'local-server', protocolVersion: 2, connected: !!this.authority.socket?.connected,
        serverPid: (this.options.authoritySession as AuthoritySession | undefined)?.pid || null,
        revision: this.authorityState?.revision ?? null,
        serverTime: this.authorityState?.serverTime ?? null,
        doors: this.authorityState?.doors || [],
        containers: this.authorityState?.containers || [],
        groundItems: this.authorityState?.groundItems || [],
        conversationTargets: this.authorityState?.conversationTargets || [],
        checkpoint: this.getCheckpointDevelopmentState(),
        pause: this.getPauseDevelopmentState(),
        actor: this.authorityState?.actors.find(actor => actor.id === this.player?.id) || null
      } : null,
      interaction,
      scriptMessage: this.scriptMessage ? { ...this.scriptMessage } : null,
      clientScriptState: this.scriptRuntime?.snapshot() || {},
      scriptObjects: [...(this.scriptObjects || [])].map(([id, off]) => ({ id, off })),
      ground: this.groundState ? { ...this.groundState } : null,
      conversation: this.conversationState ? { ...this.conversationState,
        options: this.conversationState.options?.map( (option)=>({...option}))}:null,
      journal: this.journalState ? { ...this.journalState,
        entries: this.journalState.entries?.map( (entry)=>({...entry}))}:null,
      character: this.characterState ? { ...this.characterState,
        ...('attributes' in this.characterState ? { attributes: this.characterState.attributes.map( (row)=>({...row}))}:{}),
        ...('derived' in this.characterState ? { derived: { ...this.characterState.derived } } : {}) } : null,
      inventory: this.inventoryState ? { ...this.inventoryState,
        ...(this.inventoryState.carrying ? { carrying: { ...this.inventoryState.carrying } } : {}),
        items: this.inventoryState.items?.map( (item)=>({...item}))}:null,
      pause: this.pauseState ? { ...this.pauseState } : null,
      player: this.player ? { id: this.player.id, type: this.player.base.type,
        location: Location.transformToRaw(this.player.base.location),
        spritePosition: sprite ? [sprite.iso.x, sprite.iso.y] : null,
        rendered: !!(sprite && sprite.iso.parent), moving: !!this.movement } : null,
      camera: center ? [center.x, center.y] : null,
      unsupported: ['campaign', 'NPC AI', 'combat', 'remaining original dialogue/script/quest coverage', 'inventory rules',
        'party', 'magic', 'campaign saves', 'network play', 'roof edge fading',
        'animated/dynamic lighting', 'wall light gradients', 'lighting shadows']
    }
  }

  async movePlayerTo(destination: Location | Array<number>): Promise<MovementCompletion> {
    if (this.authority) return this.moveAuthoritativePlayer(destination)
    if (!this.ready || this.options.standaloneMode !== true) throw new Error('Offline player is not ready')
    if (this.movement || this.preparingMovement) throw new Error('Player is already moving')
    const target = new Location(Location.transformToRaw(destination))
    const start = new Location(Location.transformToRaw(this.player.base.location))
    if (start.equals(target)) return { path: [Location.transformToRaw(start)] }
    const path = this.map.pathFind.findPath(start, target)
    if (!path.length) throw new Error(`No walkable path to ${target.x},${target.y}`)
    if (path.length === 1) return { path: path.map((p: Location) => Location.transformToRaw(p)) }
    this.preparingMovement = true
    try {
      const visual = this.player.visual.classes.current
      const direction = String(Location.velocityToDirection(Location.calculateVelocity(path[0], path[1])))
      visual.animation = 'Walk'
      visual.stage = direction
      await visual.sprite.change(visual)
      if (!this.ready || this.stopped) throw new Error('Client stopped during movement preparation')
      return await new Promise<MovementCompletion>((resolve, reject) => {
        this.movement = { path, index: 1, elapsed: 0, resolve, reject }
      })
    } finally {
      this.preparingMovement = false
    }
  }

  advancePlayerMovement(dt: number) {
    if (this.authority) {
      this.updateAuthorityPresentation()
      return
    }
    const movement = this.movement as OfflineMovement | null
    if (!movement) return
    movement.elapsed += Math.max(0, dt)
    const sprite = this.player.visual.classes.current.sprite
    while (movement.elapsed >= 1000 && movement.index < movement.path.length) {
      const previous = movement.path[movement.index - 1]
      const next = movement.path[movement.index]
      this.map.moveEntity(this.player, previous, next)
      this.player.base.location.set([next.x, next.y])
      movement.index++
      movement.elapsed -= 1000
    }
    if (movement.index >= movement.path.length) {
      const last = movement.path.length - 1
      sprite.stage = String(Location.velocityToDirection(
        Location.calculateVelocity(movement.path[last - 1], movement.path[last])))
      sprite.setPosition(this.player.base.location.x * 40, this.player.base.location.y * 40)
      this.movement = null
      const visual = this.player.visual.classes.current
      visual.animation = 'Stand'
      sprite.change(visual).then(() => movement.resolve({ path: movement.path.map((p: Location) => Location.transformToRaw(p)) }),
        error => { movement.reject(error); this.onRuntimeError(error) })
      return
    }
    const previous = movement.path[movement.index - 1]
    const next = movement.path[movement.index]
    const fraction = movement.elapsed / 1000
    sprite.stage = String(Location.velocityToDirection(Location.calculateVelocity(previous, next)))
    sprite.setFrame(sprite.frame)
    sprite.setPosition((previous.x + (next.x - previous.x) * fraction) * 40,
      (previous.y + (next.y - previous.y) * fraction) * 40)
  }

  async moveAuthoritativePlayer(destination: Location | number[]): Promise<MovementCompletion> {
    this.assertAuthorityCommandReady()
    this.invalidateConversation()
    this.clearContainerInspection()
    this.preparingMovement = true
    try {
      const result = await this.authority.move(this.player.id, Location.transformToRaw(destination))
      if (!this.ready || this.stopped) throw new Error('Client stopped during movement request')
      this.authorityLastPath = result.path
      if (result.status === 'completed') {
        await this.authorityVisualReady
        return { path: result.path, commandId: result.id }
      }
      return await new Promise<MovementCompletion>((resolve, reject) => {
        this.movement = { commandId: result.id, path: result.path, resolve, reject }
        // A delayed acknowledgement can arrive after a completion snapshot.
        this.applyAuthoritySnapshot(this.authority.snapshot!)
      })
    } finally { this.preparingMovement = false }
  }

  getInteractionTarget(targetId: string): InteractionTarget | undefined {
    if (this.scriptObjects?.get(targetId) === true) return undefined
    return this.authorityState?.doors?.find(target => target.id === targetId) ||
      this.authorityState?.containers?.find(target => target.id === targetId) ||
      this.authorityState?.groundItems?.find(target => target.id === targetId) ||
      this.authorityState?.conversationTargets?.find(target => target.id === targetId)
  }

  getConversationSession() {
    if (!this.conversationSession) this.conversationSession = new ConversationSession(this)
    return this.conversationSession
  }

  beginConversation(targetId: string) { return this.getConversationSession().begin(targetId) }
  replyConversation(optionId: string) { return this.getConversationSession().reply(optionId) }
  refreshJournal() { return this.getConversationSession().refreshJournal() }
  closeConversation() { return this.getConversationSession().close() }
  invalidateConversation(message?: string) { this.conversationSession?.invalidate(message) }

  getCharacterSession() {
    if (!this.characterSession) this.characterSession = new CharacterSession(this)
    return this.characterSession
  }

  refreshCharacter() { return this.getCharacterSession().refresh() }
  spendCharacterPoint(statId: string) { return this.getCharacterSession().buy(statId) }

  clearContainerInspection() {
    if (this.interactionState?.kind !== 'container') return
    this.interactionState = null
    if (!this.stopped) this.events.emit('Player:InteractionUpdated', null)
  }

  setInteractionState(targetId: string, status: string, message: string, result: ResponsePayload | null = null, items: PrivateItem[] | null = null, revision: number | null = null) {
    if (this.stopped) return
    const target = this.getInteractionTarget(targetId)
    const current = this.inventoryState?.known === true && this.inventoryState.status === 'ready' &&
      Number.isSafeInteger(revision) && revision === this.authorityState?.revision
    this.interactionState = {
      targetId,
      kind: target?.kind ||( this.interactionState?.targetId === targetId ? this.interactionState?.kind : null) || 'door',
      label: target?.label || 'Object',
      status,
      message,
      open: typeof result?.open === 'boolean' ? result.open : target?.open,
      locked: target?.locked,
      // Item rows enter presentation only through the requesting owner's
      // private inspection acknowledgement, never a public world snapshot.
      ...(Array.isArray(items) ? { inspected: true, items, revision,
        canTake: current, canPut: current } : {})
    }
    this.events.emit('Player:InteractionUpdated', this.interactionState)
  }

  async useTarget(targetId: string, { groundAction = false, conversationAction = false } = {}) {
    let preparing = false
    try {
      this.assertAuthorityCommandReady({ allowGroundRequest: groundAction, allowConversationRequest: conversationAction })
      if (!conversationAction) this.invalidateConversation()
      const container = this.getInteractionTarget(targetId)?.kind === 'container'
      const ground = this.getInteractionTarget(targetId)?.kind === 'ground'
      const conversation = this.getInteractionTarget(targetId)?.kind === 'conversation'
      this.preparingMovement = true
      preparing = true
      this.setInteractionState(targetId, 'pending', container ? 'Inspecting container…' : ground ? 'Reaching item…' : conversation ? 'Reaching speaker…' : 'Using door…')
      const accepted = await this.authority.use(this.player.id, targetId)
      if (!this.ready || this.stopped) throw new Error('Client stopped during interaction request')
      this.authorityLastPath = accepted.path
      let completed: MovementCompletion
      if (accepted.status === 'completed') {
        await this.authorityVisualReady
        completed = { path: accepted.path, commandId: accepted.id, result: accepted.result }
      } else {
        this.setInteractionState(targetId, 'approaching', container ? 'Approaching container…' : ground ? 'Approaching item…' : conversation ? 'Approaching speaker…' : 'Approaching door…')
        completed = await new Promise<MovementCompletion>((resolve, reject) => {
          this.movement = { commandId: accepted.id, path: accepted.path,
            type: 'use', targetId, resolve, reject }
          // Completion can precede a delayed command acknowledgement.
          this.applyAuthoritySnapshot(this.authority.snapshot!)
        })
      }
      if (!this.ready || this.stopped) throw new Error('Client stopped during interaction completion')
      if (container) {
        if (completed.result?.kind !== 'container' || completed.result.targetId !== targetId) {
          throw new Error('Local server supplied an invalid container interaction')
        }
        const inspection = await this.authority.inspect(this.player.id, targetId)
        if (!this.ready || this.stopped) throw new Error('Client stopped during container inspection')
        if (this.pauseRequest || this.authorityState?.pause?.paused) {
          throw Object.assign(new Error('The local game is paused'), { code: 'PAUSED' })
        }
        const result = inspection.result
        if (Number.isSafeInteger(inspection.revision) && inspection.revision <( this.ownershipRevision || 0)) {
          throw Object.assign(new Error('Container inspection was superseded; inspect again'), { code: 'STALE_REVISION' })
        }
        if (inspection.status !== 'completed' || result?.kind !== 'container' || result.targetId !== targetId) {
          throw new Error('Local server supplied invalid container contents')
        }
        let items
        try { items = privateItems(result.items) }
        catch (_) { throw new Error('Local server supplied invalid container contents') }
        completed = { path: completed.path, commandId: inspection.id, approachCommandId: completed.commandId,
          result: { kind: 'container', targetId, items } }
        this.setInteractionState(targetId, 'completed', items.length ? 'Container inspected.' : 'This container is empty.', null, items, inspection.revision)
      } else if (conversation) {
        if (completed.result?.kind !== 'conversation' || completed.result.targetId !== targetId) {
          throw new Error('Local server supplied an invalid conversation approach')
        }
        this.setInteractionState(targetId, 'completed', 'Speaker reached.', completed.result)
      } else if (ground) {
        if (completed.result?.kind !== 'ground' || completed.result.targetId !== targetId) {
          throw new Error('Local server supplied an invalid ground interaction')
        }
        this.setInteractionState(targetId, 'completed', 'Item reached.', completed.result)
      } else if (completed.result?.kind === 'script' && completed.result.defaultAction === 'skip') {
        this.setInteractionState(targetId, 'completed', 'The script prevented the default action.', completed.result)
      } else this.setInteractionState(targetId, 'completed', completed.result?.open ? 'Door opened.' : 'Door closed.', completed.result)
      return completed
    } catch (error) {
      this.setInteractionState(targetId, 'rejected', errorMessage(error))
      throw error
    } finally { if (preparing) this.preparingMovement = false }
  }

  readPrivateInventory(value: unknown, revision: number): InventoryState {
    if (!isRecord(value) || value.ownerId !== this.player.sourcePath ||
        !Number.isSafeInteger(revision) || revision < (this.ownershipRevision || 0)) {
      throw new Error('Local server supplied invalid private inventory')
    }
    const items = privateItems(value.items)
    const carrying = readCarryingState(value.carrying, items)
    return { status: 'ready', known: true, ownerId: value.ownerId, items, carrying, revision,
      message: items.length ? 'Inventory loaded.' : 'Your inventory is empty.' }
  }

  setInventoryState(state: InventoryState) {
    if (this.stopped) return
    this.inventoryState = state
    this.events.emit('Player:InventoryUpdated', state)
  }

  invalidateInventory(message = 'Refreshing inventory…') {
    this.inventoryEpoch = (this.inventoryEpoch || 0) + 1
    this.inventoryRequest = null
    this.setInventoryState({ status: 'pending', known: false, items: [], message })
  }

  async refreshInventory(): Promise<InventoryState | null | undefined> {
    if (!this.authority || !this.ready || !this.player || this.stopped) throw new Error('Local player is not ready')
    if (this.inventoryRequest) return this.inventoryRequest.promise
    const request: InventoryRequest = { epoch: this.inventoryEpoch || 0 }
    this.inventoryRequest = request
    this.setInventoryState({ status: 'pending', known: false, items: [], message: 'Refreshing inventory…' })
    request.promise = (async()=>{
      try {
        const response = await this.authority.inventory(this.player.id)
        if (this.stopped || !this.ready) throw new Error('Client stopped during inventory request')
        if (request.epoch !==( this.inventoryEpoch || 0)) {
          throw Object.assign(new Error('Inventory request was superseded'), { code: 'INVENTORY_SUPERSEDED' })
        }
        const result = response.result
        if (response.status !== 'completed' || !Number.isSafeInteger(response.revision) || response.revision < 0 ||
            result?.kind !== 'inventory' || typeof result.ownerId !== 'string' || !result.ownerId || result.ownerId !== this.player.sourcePath ||
            response.revision <( this.ownershipRevision || 0)) throw new Error('Local server supplied invalid private inventory')
        const inventory = this.readPrivateInventory(result, response.revision)
        this.setInventoryState(inventory)
        if (this.interactionState?.inspected && this.interactionState.revision === this.authorityState?.revision) {
          this.interactionState = { ...this.interactionState, canTake: true, canPut: true }
          this.events.emit('Player:InteractionUpdated', this.interactionState)
        }
        return this.inventoryState
      } catch (error) {
        if (!this.stopped && request.epoch ===( this.inventoryEpoch || 0)) {
          this.setInventoryState({ status: errorCode(error) === 'INVENTORY_UNAVAILABLE' ? 'unavailable' : 'rejected',
            known: false, items: [], message: errorMessage(error) })
        }
        if (errorCode(error) === 'INVENTORY_UNAVAILABLE') return this.inventoryState
        throw error
      } finally { if (this.inventoryRequest === request) this.inventoryRequest = null }
    })()
    return request.promise
  }

  takeItem(targetId: string, itemId: string) { return this.transferItem('take', targetId, itemId) }

  takeAllItems(targetId: string) { return this.transferItem('take-all', targetId) }

  putItem(targetId: string, itemId: string) { return this.transferItem('put', targetId, itemId) }

  setGroundState(action: string, status: string, message: string) {
    if (this.stopped) return
    this.groundState = { action, status, message }
    this.events.emit('Player:GroundUpdated', this.groundState)
  }

  pickupGroundItem(targetId: string) { return this.transferGroundItem('pickup', targetId) }

  dropItem(itemId: string) { return this.transferGroundItem('drop', itemId) }

  async transferGroundItem(action: 'pickup' | 'drop', itemId: string) {
    let request: ActionRequest | undefined
    try {
      this.assertAuthorityCommandReady()
      if (!this.inventoryState?.known || this.inventoryState.status !== 'ready') {
        throw Object.assign(new Error('Actor inventory is unavailable; ownership must be explicitly known'), { code: 'INVENTORY_UNAVAILABLE' })
      }
      const before = privateItems(this.inventoryState.items)
      const source = action === 'pickup' ? groundItems(this.authorityState?.groundItems || []).find(item => item.id === itemId) :
        before.find(item => item.id === itemId && item.canDrop === true)
      if (!source ||( action !== 'pickup' && action !== 'drop')) {
        throw Object.assign(new Error('This item does not support the requested ground action'), { code: 'UNSUPPORTED_ITEM' })
      }
      if (action === 'pickup' && before.some(item => item.id === itemId)) throw new Error('Ground and inventory views disagree')
      request = { action, epoch: this.inventoryEpoch || 0 }
      this.groundRequest = request
      this.invalidateConversation()
      this.clearContainerInspection()
      this.setGroundState(action, 'pending', action === 'pickup' ? 'Picking up item…' : 'Dropping item…')
      if (action === 'pickup') await this.useTarget(itemId, { groundAction: true })
      this.assertAuthorityCommandReady({ allowGroundRequest: true })
      if (request.epoch !==( this.inventoryEpoch || 0)) throw Object.assign(new Error('Ground action was superseded'), { code: 'INVENTORY_SUPERSEDED' })
      const revision = this.authorityState.revision
      const actorLocation = [...this.authorityState.actors.find(actor => actor.id === this.player.id)!.location]
      request.commandId = this.authority.nextId
      this.transferRequest = request
      const response = await this.authority[action](this.player.id, itemId, revision)
      if (this.stopped || !this.ready) throw new Error('Client stopped during ground action')
      if (request.epoch !==( this.inventoryEpoch || 0)) throw Object.assign(new Error('Ground action was superseded'), { code: 'INVENTORY_SUPERSEDED' })
      const result = response.result
      if (response.status !== 'completed' || !Number.isSafeInteger(response.revision) || response.revision <= revision ||
          result?.kind !== action || result[action === 'pickup' ? 'targetId' : 'itemId'] !== itemId ||
          result.inventory?.ownerId !== this.player.sourcePath) throw new Error('Local server supplied an invalid ground transfer')
      const inventoryView = this.readPrivateInventory(result.inventory, response.revision)
      const inventory = inventoryView.items
      const unchanged = before.filter(item => item.id !== itemId)
      if (unchanged.some(item => JSON.stringify(inventory.find(row => row.id === item.id)) !== JSON.stringify(item)) ||
          inventory.length !== before.length +( action === 'pickup' ? 1 : -1)) throw new Error('Local server supplied inconsistent ground ownership')
      if (action === 'pickup') {
        const item = inventory.find(row => row.id === itemId)
        const occupied = new Set(before.map(row => row.slot))
        let slot = 0
        while (occupied.has(slot)) slot++
        if (!item || item.slot !== slot || item.label !== source.label || item.type !== source.type ||
            item.prototypeId !== source.prototypeId || item.canDrop !== true || item.quantity !== undefined) {
          throw new Error('Local server changed the picked-up item')
        }
      } else {
        const [ground] = groundItems([result.ground])
        if (inventory.some(item => item.id === itemId) || ground.id !== itemId || ground.label !== source.label ||
            ground.type !== source.type || ground.prototypeId !== source.prototypeId ||
            JSON.stringify(ground.location) !== JSON.stringify(actorLocation)) throw new Error('Local server changed the dropped item')
      }
      this.ownershipRevision = response.revision
      const message = action === 'pickup' ? 'Item picked up.' : 'Item dropped.'
      this.setInventoryState({ ...inventoryView, message: inventory.length ? message : `${message} Your inventory is empty.` })
      await this.groundVisualReady
      if (this.stopped || request.epoch !==( this.inventoryEpoch || 0)) throw new Error('Ground action was superseded')
      this.setGroundState(action, 'completed', message)
      return { commandId: response.id, revision: response.revision, result: { ...result,
        inventory: { ownerId: result.inventory!.ownerId, items: inventory, carrying: inventoryView.carrying } } }
    } catch (error) {
      if (request?.commandId && !this.stopped && request.epoch ===( this.inventoryEpoch || 0)) {
        this.invalidateInventory('Checking item ownership…')
        await this.refreshInventory().catch(() => {})
      }
      if (!this.stopped &&( !this.groundRequest || this.groundRequest === request)) this.setGroundState(action, 'rejected', errorMessage(error))
      throw error
    } finally {
      if (this.transferRequest === request) this.transferRequest = null
      if (this.groundRequest === request) this.groundRequest = null
    }
  }

  async transferItem(action: 'take' | 'put' | 'take-all', targetId: string, itemId?: string) {
    let request: ActionRequest | undefined
    try {
      if (!['take', 'take-all', 'put'].includes(action)) throw new Error('Unsupported item transfer')
      this.assertAuthorityCommandReady()
      this.invalidateConversation()
      const inspected = this.interactionState
      if (!inspected?.inspected || inspected.targetId !== targetId || !Number.isSafeInteger(inspected.revision) ||
          inspected.revision !== this.authorityState?.revision) {
        throw Object.assign(new Error('Inspect the container again before transferring an item'), { code: 'STALE_REVISION' })
      }
      if (!this.inventoryState?.known || this.inventoryState.status !== 'ready') {
        throw Object.assign(new Error('Actor inventory is unavailable; ownership must be explicitly known'), { code: 'INVENTORY_UNAVAILABLE' })
      }
      const before = privateItems(this.inventoryState.items)
      const containerBefore = privateItems(inspected.items)
      const taking = action !== 'put', batch = action === 'take-all'
      const source = taking ? containerBefore : before
      const destination = taking ? before : containerBefore
      // A batch names only its container on the wire. Keep the entire inspected
      // set locally to check the private ACK; the server selects and validates
      // every item, including behavior flags that presentation cannot inspect.
      const selected = batch ? [...source].sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id)) : source.filter(item => item.id === itemId)
      if (batch && !selected.length) throw Object.assign(new Error('This container is empty'), { code: 'EMPTY_CONTAINER' })
      if (!batch &&( !selected.length || !['Generic', 'Key'].includes(selected[0].type))) {
        throw Object.assign(new Error('Only a supported whole item can be transferred'), { code: 'UNSUPPORTED_ITEM' })
      }
      if (before.some(entry => containerBefore.some(other => other.id === entry.id))) {
        throw Object.assign(new Error('Private inventory views disagree; inspect again'), { code: 'INVENTORY_UNAVAILABLE' })
      }
      request = { action, commandId: this.authority.nextId, targetId, epoch: this.inventoryEpoch || 0 }
      this.transferRequest = request
      this.setInteractionState(targetId, 'pending', batch ? 'Taking all items…' : taking ? 'Taking item…' : 'Putting item in container…')
      const response = await( batch ? this.authority.takeAll(this.player.id, targetId, inspected.revision) :
        this.authority[action as 'take' | 'put'](this.player.id, targetId, itemId!, inspected.revision!))
      if (this.stopped || !this.ready) throw new Error('Client stopped during item transfer')
      if (request.epoch !==( this.inventoryEpoch || 0)) {
        throw Object.assign(new Error('Item transfer was superseded; inspect again'), { code: 'INVENTORY_SUPERSEDED' })
      }
      const result = response.result
      if (response.status !== 'completed' || !Number.isSafeInteger(response.revision) || response.revision <= inspected.revision ||
          result?.kind !== action || result.targetId !== targetId ||(
           batch ? selected.some(item => !['Generic', 'Key'].includes(item.type)) || !Array.isArray(result.itemIds) ||
            JSON.stringify(result.itemIds) !== JSON.stringify(selected.map(item => item.id)) : result.itemId !== itemId) ||
          result.inventory?.ownerId !== this.player.sourcePath) throw new Error('Local server supplied an invalid item transfer')
      const remaining = privateItems(result.items), inventoryView = this.readPrivateInventory(result.inventory, response.revision)
      const inventory = inventoryView.items
      const sourceAfter = taking ? remaining : inventory
      const destinationAfter = taking ? inventory : remaining
      const selectedIds = new Set(selected.map(item => item.id))
      const expected = source.filter(entry => !selectedIds.has(entry.id))
      const expectedIds = new Set([...destination.map(entry => entry.id), ...selectedIds])
      const occupied = new Set(destination.map(entry => entry.slot))
      const changedItem = selected.some(item => {
        const moved = destinationAfter.find(entry => entry.id === item.id)
        let slot = 0
        while (occupied.has(slot)) slot++
        occupied.add(slot)
        return !moved ||( batch && moved.slot !== slot) || JSON.stringify({ ...moved, slot: item.slot }) !== JSON.stringify(item)
      })
      if (sourceAfter.length !== expected.length || expected.some(entry =>
            JSON.stringify(sourceAfter.find(other => other.id === entry.id)) !== JSON.stringify(entry)) ||
          destinationAfter.length !== destination.length + selected.length || changedItem ||
          destinationAfter.some(entry => !expectedIds.has(entry.id)) ||
          destination.some(entry => JSON.stringify(destinationAfter.find(other => other.id === entry.id)) !== JSON.stringify(entry)) ||
          remaining.some(entry => inventory.some(other => other.id === entry.id))) throw new Error('Local server supplied inconsistent item ownership')
      this.ownershipRevision = response.revision
      const message = batch ? 'All items taken.' : taking ? 'Item taken.' : 'Item put in container.'
      this.setInventoryState({ ...inventoryView, message: inventory.length ? message : `${message} Your inventory is empty.` })
      this.setInteractionState(targetId, 'completed', remaining.length ? message : `${message} This container is empty.`, null, remaining, response.revision)
      return { commandId: response.id, revision: response.revision, result: { ...result, items: remaining,
        inventory: { ownerId: result.inventory!.ownerId, items: inventory, carrying: inventoryView.carrying } } }
    } catch (error) {
      if (request && !this.stopped && request.epoch ===( this.inventoryEpoch || 0)) {
        // A timeout may hide a committed transfer. Re-read; never retry it.
        this.invalidateInventory('Checking item ownership…')
        await this.refreshInventory().catch(() => {})
      }
      if (!this.stopped &&( !this.transferRequest || this.transferRequest === request)) {
        this.setInteractionState(targetId, 'rejected', errorMessage(error))
      }
      throw error
    } finally { if (this.transferRequest === request) this.transferRequest = null }
  }

  assertAuthorityCommandReady({ allowPaused = false, allowGroundRequest = false, allowConversationRequest = false } = {}) {
    if (!this.authority || !this.ready || !this.player || this.stopped) throw new Error('Local player is not ready')
    if (this.pauseRequest || this.pausePending) {
      throw Object.assign(new Error('A pause action is already in progress'), { code: 'BUSY' })
    }
    if (!allowPaused && this.authorityState?.pause?.paused) {
      throw Object.assign(new Error('The local game is paused'), { code: 'PAUSED' })
    }
    if (this.checkpointRequest || this.checkpointPending || this.authorityState?.checkpoint?.busy) {
      throw Object.assign(new Error('A checkpoint action is already in progress'), { code: 'BUSY' })
    }
    if (this.transferRequest || this.inventoryRequest ||( this.groundRequest && !allowGroundRequest)) {
      throw Object.assign(new Error('An inventory action is already in progress'), { code: 'BUSY' })
    }
    if (this.characterRequest || this.journalRequest ||( this.conversationRequest && !allowConversationRequest)) {
      throw Object.assign(new Error('A conversation or journal action is already in progress'), { code: 'BUSY' })
    }
    if (this.movement || this.preparingMovement ||
        this.authorityState?.actors.find(actor => actor.id === this.player.id)?.movement) {
      throw Object.assign(new Error('Player is already moving'), { code: 'BUSY' })
    }
  }

  getCheckpointDevelopmentState() {
    const state = this.authorityState?.checkpoint
    if (!state) return { supported: false, busy: false }
    // Diagnostics expose capability and outcomes, never private save paths or
    // credentials. Error fields also follow an explicit public allowlist.
    return { supported: state.supported === true, busy: state.busy === true,
      ...(['save', 'load'].includes(state.lastAction || '') ? { lastAction: state.lastAction } : {}),
      ...(typeof state.savedAt === 'string' ? { savedAt: state.savedAt } : {}),
      ...(state.error && typeof state.error.message === 'string' ? { error: {
        ...(typeof state.error.code === 'string' ? { code: state.error.code } : {}),
        message: state.error.message } } : {}) }
  }

  getPauseDevelopmentState() {
    const state = this.authorityState?.pause
    return { supported: state?.supported === true, paused: state?.paused === true }
  }

  publishPauseState(status = this.pauseState?.status || 'idle', message?: string) {
    if (this.stopped) return
    const state = this.getPauseDevelopmentState()
    this.pauseState = { ...state, moving: !!this.authorityState?.actors.find(actor => actor.id === this.player?.id)?.movement,
      status, message: message ||( status === 'pending' ? this.pauseState?.message :
        state.paused ? 'Local game paused.' : 'Local game running.') }
    const signature = JSON.stringify(this.pauseState)
    if (signature !== this.pauseSignature) {
      this.pauseSignature = signature
      this.events.emit('Player:PauseUpdated', this.pauseState)
    }
  }

  async setPaused(paused: boolean) {
    let request: ActionRequest | undefined
    try {
      if (!this.authority || !this.ready || !this.player || this.stopped) throw new Error('Local player is not ready')
      if (typeof paused !== 'boolean') throw new Error('Pause state must be a boolean')
      if (this.pauseRequest || this.pausePending || this.checkpointRequest || this.checkpointPending || this.transferRequest || this.inventoryRequest || this.groundRequest || this.conversationRequest || this.journalRequest || this.characterRequest ||
          this.authorityState?.checkpoint?.busy) {
        throw Object.assign(new Error('Another session action is already in progress'), { code: 'BUSY' })
      }
      if (this.authorityState?.pause?.supported !== true) {
        throw Object.assign(new Error('Pausing is unavailable for this session'), { code: 'PAUSE_UNAVAILABLE' })
      }
      const action = paused ? 'pause' : 'resume'
      request = { action, paused }
      this.pauseRequest = request
      this.invalidateConversation()
      this.clearContainerInspection()
      this.publishPauseState('pending', paused ? 'Pausing local game…' : 'Resuming local game…')
      // Pause is permitted while an existing movement or approach is pending.
      // Its acknowledgement must never replace that command's completion wait.
      const accepted = await this.authority[action](this.player.id)
      if (!this.ready || this.stopped) throw new Error('Client stopped during pause request')
      if (accepted.status !== 'completed' || accepted.result?.kind !== action || accepted.result.paused !== paused ||
          !Number.isSafeInteger(accepted.id) || accepted.id < 1 ||
          !Number.isSafeInteger(accepted.revision) || accepted.revision < 0) {
        throw new Error('Local server supplied an invalid pause result')
      }
      const completed = await new Promise<PauseCompletion>((resolve, reject) => {
        const pending: PausePending = { action, paused, commandId: accepted.id, revision: accepted.revision, resolve, reject }
        this.pausePending = pending
        pending.timer = setTimeout(() => {
          if (this.pausePending !== pending) return
          this.pausePending = null
          reject(Object.assign(new Error('Timed out waiting for the local pause state'), { code: 'PAUSE_TIMEOUT' }))
        }, 5000)
        // A pause leaves actor.lastCommand intact. Reconcile the acknowledged
        // revision and server pause state, including broadcasts received first.
        this.reconcilePause()
      })
      if (!this.ready || this.stopped) throw new Error('Client stopped during pause completion')
      this.publishPauseState('completed')
      return completed
    } catch (error) {
      if (request ||( !this.pauseRequest && !this.pausePending)) this.publishPauseState('rejected', errorMessage(error))
      throw error
    } finally {
      if (this.pauseRequest === request) this.pauseRequest = null
    }
  }

  reconcilePause() {
    const pending = this.pausePending
    if (!pending || this.stopped || !this.ready || (this.authorityState?.revision ?? -1) < pending.revision) return
    this.pausePending = null
    clearTimeout(pending.timer)
    if (this.authorityState?.pause?.paused !== pending.paused) {
      pending.reject(Object.assign(new Error('A newer session action changed the local pause state'), { code: 'PAUSE_SUPERSEDED' }))
      return
    }
    pending.resolve({ commandId: pending.commandId, kind: pending.action, paused: pending.paused })
  }

  setCheckpointState(action: string, status: string, message: string, savedAt?: string) {
    if (this.stopped) return
    this.checkpointState = { action, status, message,
      ...(typeof savedAt === 'string' ? { savedAt } : {}) }
    this.events.emit('Player:CheckpointUpdated', this.checkpointState)
  }

  saveCheckpoint() { return this.requestCheckpoint('save') }

  loadCheckpoint() { return this.requestCheckpoint('load') }

  async requestCheckpoint(action: 'save' | 'load') {
    let request: ActionRequest | undefined
    try {
      this.assertAuthorityCommandReady({ allowPaused: true })
      this.invalidateConversation()
      if (action === 'load') {
        this.clearContainerInspection()
        if (this.inventoryState) this.invalidateInventory('Loading inventory…')
      }
      request = { action }
      this.checkpointRequest = request
      this.setCheckpointState(action, 'pending', action === 'save' ? 'Saving checkpoint…' : 'Loading checkpoint…')
      const accepted = await this.authority[action](this.player.id)
      if (!this.ready || this.stopped) throw new Error('Client stopped during checkpoint request')
      if (accepted.status !== 'completed' || accepted.result?.kind !== action ||
          typeof accepted.result.savedAt !== 'string') throw new Error('Local server supplied an invalid checkpoint result')
      const completed = await new Promise<CheckpointCompletion>((resolve, reject) => {
        this.checkpointPending = { action, commandId: accepted.id, resolve, reject }
        // A terminal snapshot can precede its acknowledgement. Reconcile the
        // newest received state without writing the acknowledgement into it.
        this.reconcileCheckpoint()
      })
      if (!this.ready || this.stopped) throw new Error('Client stopped during checkpoint completion')
      if (action === 'load' && this.inventoryState) await this.refreshInventory()
      if (action === 'load' && this.journalState) await this.getConversationSession().fetchJournal()
      this.setCheckpointState(action, 'completed', action === 'save' ? 'Checkpoint saved.' : 'Checkpoint loaded.', completed.savedAt)
      return completed
    } catch (error) {
      // A second local request must not replace an outstanding action's status.
      if (request ||( !this.checkpointRequest && !this.checkpointPending)) {
        this.setCheckpointState(action, 'rejected', errorMessage(error))
      }
      if (request && action === 'load' && this.inventoryState && !this.stopped && !this.inventoryRequest) {
        await this.refreshInventory().catch(() => {})
      }
      throw error
    } finally {
      if (this.checkpointRequest === request) this.checkpointRequest = null
    }
  }

  reconcileCheckpoint() {
    const pending = this.checkpointPending
    if (!pending || pending.finishing) return
    const command = this.authorityState?.actors.find(actor => actor.id === this.player?.id)?.lastCommand
    if (command?.id !== pending.commandId || command.type !== pending.action) return
    if (command.status === 'interrupted') {
      this.checkpointPending = null
      pending.reject(Object.assign(new Error(command.message || 'Checkpoint action was interrupted'), { code: command.code }))
    } else if (command.status === 'completed' && command.result?.kind === pending.action &&
        typeof command.result.savedAt === 'string') {
      pending.finishing = true
      Promise.all([this.authorityVisualReady, this.groundVisualReady]).then(() => {
        if (this.checkpointPending !== pending || this.stopped) return
        this.checkpointPending = null
        pending.resolve({ commandId: pending.commandId, kind: pending.action, savedAt: command.result!.savedAt! })
      }, error => this.onRuntimeError(error))
    }
  }

  applyAuthorityDoors(doors: InteractionTarget[]) {
    const entities = new Map()
    for (const entity of this.world.entityManager.entities.values()) {
      if (entity.sourcePath) entities.set(entity.sourcePath, entity)
    }
    for (const door of doors) {
      const entity = entities.get(door.id)
      if (!entity) throw new Error('Local server door has no matching map object')
      // Unsupported artwork has no managed pose on the host. Preserve its
      // converted collision flags here too, including an inherited NoBlock.
      if (!Number.isInteger(door.closedFrame) || !Number.isInteger(door.openFrame)) continue
      entity.portalOpen = door.open
      const sprite = entity.visual?.classes?.current?.sprite
      const frame = door.open ? door.openFrame : door.closedFrame
      if (sprite && Number.isInteger(door.openFrame) && Number.isInteger(door.closedFrame)) sprite.setPortalState(frame)
    }
    const signature = JSON.stringify(doors)
    if (signature !== this.authorityDoorSignature) {
      this.authorityDoorSignature = signature
      this.events.emit('World:InteractionsUpdated', doors)
    }
  }

  applyAuthorityContainers(containers: InteractionTarget[]) {
    const signature = JSON.stringify(containers)
    if (signature !== this.authorityContainerSignature) {
      this.authorityContainerSignature = signature
      this.events.emit('World:ContainersUpdated', containers)
    }
  }

  applyAuthorityGroundItems(rows: unknown) {
    const items = groundItems(rows)
    const signature = JSON.stringify(items)
    if (signature === this.authorityGroundSignature) return
    const entities = new Map([...this.world.entityManager.entities.values()]
      .filter(entity => entity.sourcePath).map(entity => [entity.sourcePath, entity]))
    for (const item of items) {
      const entity = entities.get(item.id)
      if (!entity || entity.item?.groundTransferSupported !== true || entity.base.type !== 'Generic' ||
          entity.base.prototype !== item.prototypeId || !entity.base.flags.has('NoBlock') ||
          !this.map.getTile(...item.location)) throw new Error('Local server ground item has no matching authored map object')
    }
    const visible = new Map(items.map(item => [item.id, item]))
    const managed = [...entities.values()].filter(entity => entity.item?.groundTransferSupported === true && entity.base.type === 'Generic')
    for (const entity of managed) {
      if (!entity.groundInitialLocation) entity.groundInitialLocation = Location.transformToRaw(entity.base.location)
      const row = visible.get(entity.sourcePath)
      const location = row?.location || entity.groundInitialLocation
      const next = new Location(location)
      if (!entity.base.location.equals(next)) {
        this.map.moveEntity(entity, entity.base.location, next)
        entity.base.location.set(location)
      }
      entity.ground = !!row
      const sprite = entity.visual?.classes?.current?.sprite
      if (sprite) {
        sprite.iso.visible = entity.ground
        sprite.setPosition(location[0] * 40, location[1] * 40)
      }
    }
    this.authorityGroundSignature = signature
    this.events.emit('World:GroundItemsUpdated', items)
    if (!managed.length) return
    // Keep loaded artwork for later drops. Recheck the latest committed state
    // after an asynchronous first load so an older drop cannot revive a pickup.
    this.groundVisualReady = Promise.resolve(this.groundVisualReady).then(async () => {
      if (this.stopped) return
      for (const entity of managed) {
        if (entity.ground && !entity.visual?.classes?.current?.sprite?.iso.parent) {
          await this.scene.addEntity(entity, this.map.objectGroup)
        }
        if (this.stopped) return
        const sprite = entity.visual?.classes?.current?.sprite
        if (sprite) {
          sprite.iso.visible = entity.ground === true
          sprite.setPosition(entity.base.location.x * 40, entity.base.location.y * 40)
        }
      }
      this.scene.sortGroup(this.map.objectGroup)
    })
    this.groundVisualReady.catch(error => this.onRuntimeError(error))
  }

  private disposeClientScripts(): void {
    const runtime = this.scriptRuntime
    const loader = this.scriptLoader
    this.scriptRuntime = undefined
    this.scriptLoader = undefined
    this.scriptPacket = undefined
    this.scriptPrograms = []
    runtime?.dispose()
    loader?.dispose()
  }

  initializeClientScripts(): void {
    this.disposeClientScripts()
    const programs: ClientScriptDefinition[] = []
    if (typeof this.options.scriptManifestPath === 'string') {
      try {
        const loader = new NodeScriptLoader(this.options.scriptManifestPath, { realm: 'client' })
        this.scriptLoader = loader
        for (const entry of loader.manifest.scripts.filter(entry => entry.realm === 'client')) {
          const definition = loader.resolve(entry.id, 'client')
          if (!definition || definition.realm !== 'client') throw new Error('Client presentation module has an invalid realm')
          programs.push(definition)
        }
      } catch (error) {
        this.scriptLoader?.dispose()
        this.scriptLoader = undefined
        if (errorCode(error) !== 'ENOENT' || this.options.moduleId === 'inventory-workshop') throw error
      }
    }
    this.scriptPrograms = programs.length ? programs : [defaultPresentation]
    const epoch = this.scriptEpoch
    this.scriptRuntime = new ClientScriptEngine({ scripts: this.scriptPrograms, emitPresentation: (effect: ScriptPresentation) => {
      const packet = this.scriptPacket
      if (this.stopped || !packet || epoch !== this.scriptEpoch) return
      this.scriptMessage = { text: effect.text, epoch: packet.epoch, sequence: packet.sequence,
        ...(effect.targetId ? { targetId: effect.targetId } : {}) }
      this.events.emit('Player:ScriptMessage', this.scriptMessage)
    } })
  }

  receiveScriptPresentation(event: AuthorityPresentation): void {
    if (this.stopped || event.epoch !== this.scriptEpoch) return
    if (!this.scriptRuntime) this.initializeClientScripts()
    this.scriptPacket = event
    try {
      for (const program of this.scriptPrograms) this.scriptRuntime!.run(program.id, 0, { ...event })
    } finally { this.scriptPacket = undefined }
  }

  applyScriptObjects(rows: ScriptObjectState[]): void {
    const states = new Map(rows.map(row => [row.id, row.off]))
    const entities = [...this.world.entityManager.entities.values()].filter(entity => entity.map === this.map && entity.base.type === 'Npc')
    for (const id of states.keys()) {
      if (entities.filter(entity => entity.sourcePath === id).length !== 1) throw new Error('Unknown authoritative script object')
    }
    this.scriptObjects = states
    const loading: Promise<unknown>[] = []
    for (const entity of entities) {
      if (states.has(entity.sourcePath)) entity.scriptOff = states.get(entity.sourcePath)!
      else delete entity.scriptOff
      const off = entity.scriptOff ?? entity.base.flags.has('Off')
      const sprites = new Set(Object.values(entity.visual?.classes || {}).map(value => value.sprite).filter((value): value is Sprite => !!value))
      if (!off && !sprites.size && entity.visual) {
        this.scriptSpriteLoads ||= new Map()
        let pending = this.scriptSpriteLoads.get(entity)
        if (!pending) {
          pending = this.scene.addEntity(entity, this.map.objectGroup).then(() => {
            if (!this.stopped) this.updateScriptObjectVisibility(entity)
          }).finally(() => { this.scriptSpriteLoads.delete(entity) })
          this.scriptSpriteLoads.set(entity, pending)
        }
        loading.push(pending)
      } else this.updateScriptObjectVisibility(entity)
      if (off && this.interactionState?.targetId === entity.sourcePath) {
        this.interactionState = null
        this.events.emit('Player:InteractionUpdated', null)
      }
      if (off && this.conversationState?.targetId === entity.sourcePath) this.invalidateConversation()
    }
    this.scriptVisualReady = Promise.all(loading)
    this.scriptVisualReady.catch(error => this.onRuntimeError(error))
  }

  private updateScriptObjectVisibility(entity: Entity): void {
    const off = entity.scriptOff ?? entity.base.flags.has('Off')
    this.scriptSpriteState ||= new WeakMap()
    for (const sprite of new Set(Object.values(entity.visual?.classes || {}).map(value => value.sprite))) {
      if (!sprite) continue
      const iso = sprite.iso
      const previous = this.scriptSpriteState.get(iso)
      if (off) {
        if (!previous) this.scriptSpriteState.set(iso, { visible: iso.visible, renderable: iso.renderable, eventMode: iso.eventMode })
        iso.visible = false
        iso.renderable = false
        iso.eventMode = 'none'
      } else if (previous) {
        iso.renderable = previous.renderable
        iso.eventMode = previous.eventMode
        const tile = this.map.getTile(entity.base.location.x, entity.base.location.y)
        iso.visible = this.scene.roofLayer ? tile?.outdoor !== false || !this.scene.roofLayer.isCovered(entity.base.location, true) : previous.visible
        this.scriptSpriteState.delete(iso)
      }
    }
    this.guiManager?.setEntityVisibility?.(entity, !off)
  }

  applyAuthoritySnapshot(snapshot: AuthoritySnapshot) {
    if (snapshot.scriptEpoch !== undefined && snapshot.scriptEpoch !== this.scriptEpoch) {
      this.scriptEpoch = snapshot.scriptEpoch
      this.initializeClientScripts()
      this.scriptMessage = null
      this.events.emit('Player:ScriptMessage', null)
    }
    this.authorityState = snapshot
    this.authorityReceivedAt = performance.now()
    if (!this.ready || !this.player || !this.map) return
    const actor = snapshot.actors.find(actor => actor.id === this.player.id)
    if (!actor || snapshot.mapId !== this.map.id || !Array.isArray(actor.location) ||
        actor.location.length !== 2 || !actor.location.every(Number.isInteger)) {
      throw new Error('Local server supplied an invalid actor state')
    }
    if (snapshot.scriptObjects) this.applyScriptObjects(snapshot.scriptObjects)
    this.applyAuthorityDoors(snapshot.doors || [])
    this.applyAuthorityContainers(snapshot.containers || [])
    this.applyAuthorityGroundItems(snapshot.groundItems || [])
    this.getConversationSession().observe(snapshot, actor)
    this.getCharacterSession().observe(snapshot, actor)
    if (snapshot.pause &&( typeof snapshot.pause.supported !== 'boolean' || typeof snapshot.pause.paused !== 'boolean')) {
      throw new Error('Local server supplied an invalid pause state')
    }
    this.publishPauseState()
    const next = new Location(actor.location)
    const previous = this.player.base.location
    if (!previous.equals(next)) {
      this.map.moveEntity(this.player, previous, next)
      previous.set(actor.location)
    }
    if (actor.movement && this.interactionState?.inspected) this.clearContainerInspection()
    const ownershipCommand = actor.lastCommand
    if (ownershipCommand?.status === 'completed' && ['load', 'take', 'take-all', 'put', 'pickup', 'drop', 'buy-attribute'].includes(ownershipCommand.type || '') &&
        ownershipCommand.result?.kind === ownershipCommand.type) {
      const signature = `${ownershipCommand.type}:${ownershipCommand.id}`
      if (signature !== this.ownershipCommandSignature) {
        this.ownershipCommandSignature = signature
        this.ownershipRevision = snapshot.revision
        if (this.interactionState?.inspected && (this.interactionState.revision ?? -1) < snapshot.revision) this.clearContainerInspection()
        const ownTransfer = this.transferRequest?.commandId === ownershipCommand.id || this.characterRequest?.commandId === ownershipCommand.id
        const ownLoad = this.checkpointRequest?.action === 'load'
        if (this.inventoryState && !ownTransfer && !ownLoad && (this.inventoryState.revision ?? -1) < snapshot.revision) {
          this.invalidateInventory()
          this.refreshInventory().catch(() => {})
        }
      }
    }
    if (this.interactionState?.inspected) {
      const canTake = this.inventoryState?.known === true && this.inventoryState.status === 'ready' &&
        Number.isSafeInteger(this.interactionState.revision) && this.interactionState.revision === snapshot.revision
      if (this.interactionState.canTake !== canTake || this.interactionState.canPut !== canTake) {
        this.interactionState = { ...this.interactionState, canTake, canPut: canTake }
        this.events.emit('Player:InteractionUpdated', this.interactionState)
      }
    }
    if (actor.lastCommand?.type === 'load' && actor.lastCommand.status === 'completed' &&
        actor.lastCommand.result?.kind === 'load') {
      this.authorityLastPath = null
      this.clearContainerInspection()
    }
    if (actor.movement) this.authorityLastPath = actor.movement.path
    this.queueAuthorityAnimation(actor.movement ? 'Walk' : 'Stand')
    this.updateAuthorityPresentation()
    this.reconcileCheckpoint()
    this.reconcilePause()
    const pending = this.movement
    const lastCommand = actor.lastCommand
    if (pending && lastCommand && lastCommand.id === pending.commandId && lastCommand.status === 'interrupted') {
      this.movement = null
      const error = Object.assign(new Error(lastCommand.message || `${pending.type === 'use' ? 'Interaction' : 'Movement'} interrupted: ${lastCommand.code}`), { code: lastCommand.code })
      pending.reject(error)
    } else if (pending && !pending.finishing && lastCommand && lastCommand.id === pending.commandId &&
        lastCommand.status === 'completed') {
      pending.finishing = true
      Promise.all([this.authorityVisualReady, this.groundVisualReady]).then(() => {
        if (this.movement !== pending) return
        this.movement = null
        pending.resolve({ path: pending.path as [number, number][], commandId: pending.commandId,
          ...(lastCommand!.result ? { result: lastCommand!.result } : {}) })
      }, error => this.onRuntimeError(error))
    }
  }

  queueAuthorityAnimation(animation: string) {
    this.authorityAnimation = animation
    if (this.authorityVisualLoading) return
    const visual = this.player.visual.classes.current
    if (visual.animation === animation && !visual.sprite.loading) return
    this.authorityVisualLoading = true
    this.authorityVisualReady = (async()=>{
      do {
        const requested = this.authorityAnimation
        visual.animation = requested
        await visual.sprite.change(visual)
        if (this.stopped) return
        this.updateAuthorityPresentation()
        if (requested === this.authorityAnimation) break
      } while (!this.stopped)
    })().finally(()=>{this.authorityVisualLoading=false})
    this.authorityVisualReady.catch(error => this.onRuntimeError(error))
  }

  updateAuthorityPresentation() {
    const actor = this.authorityState?.actors.find(actor => actor.id === this.player?.id)
    if (!actor || !this.player) return
    const sprite = this.player.visual.classes.current.sprite
    const movement = actor.movement
    let x = actor.location[0], y = actor.location[1]
    const path = movement?.path || this.authorityLastPath
    if (path && path.length > 1) {
      const index = movement ? Math.min(movement.index, path.length - 2) : path.length - 2
      const previous = new Location(path[index]), next = new Location(path[index + 1])
      sprite.stage = String(Location.velocityToDirection(Location.calculateVelocity(previous, next)))
      if (movement) {
        // Extrapolate only the displayed position within the current segment.
        // Authoritative location and occupancy change only on server snapshots.
        const lag = this.authorityState?.pause?.paused ? 0 : Math.min(150, Math.max(0, performance.now() - this.authorityReceivedAt))
        const fraction = Math.min(1, (movement.elapsedMs + lag) / movement.durationMs)
        x = previous.x + (next.x - previous.x) * fraction
        y = previous.y + (next.y - previous.y) * fraction
      }
    }
    if (!sprite.loading) sprite.setFrame(sprite.frame)
    sprite.setPosition(x * 40, y * 40)
  }

  /**
   *
   * @returns {AssetLoader}
   */
  get assetLoader(): AssetLoader {
    return this.gameEngine.assetLoader
  }

  /**
   *
   * @returns {{width: number, height: number}}
   */
  getWindowRect(): Record<string, unknown> {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async create(canvas: HTMLCanvasElement) {
    lll('Client: Creating gameEngine')

    this.scene = new Scene(this)
    await this.scene.create(canvas)
    if (this.options.authoredGui !== false) await this.guiManager.loadAssets()

    /*this.listenUI(`window.resize`, () => {
      let rect = this.getWindowRect()

      //this.physics.world.setBounds(x, y, width, height, true, true, true, true);
      //this.scene.resizeViewport(rect.width, rect.height)
    })*/

    this.listenUI('startGameBtn:click', () => {
      this.events.emit('Game:Start')
    })

    //this.events.on(`objectAdded`, this.onObjectAdded.bind(this))
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async onStartGame() {
    if (this.options.standaloneMode === true) return
    await this.start()
    await this.connect()
  }

  /**
   *
   */
  updateEntities() {
    let entities = this.world.getDynamicEntities()

    for (let [id, entity] of entities) {
      this.updateEntity(entity)
    }
  }

  /**
   *
   * @param entity
   */
  updateEntity(entity: Entity) {
    this.guiManager.updateEntityBubble(entity)
  }

  /**
   *
   * @param state
   */
  step(state: StepState | number, dt?: number, physicsOnly?: boolean) {
    if (this.options.standaloneMode === true) {
      if (!this.ready || !this.world) return
      this.advancePlayerMovement(dt!)
      if (!this.authorityState?.pause?.paused) {
        this.world.entityManager.update(state as number, dt!)
        this.world.stepCount++
      }
      this.updateEntities()
      return
    }
    if (!this.world) {
      return
    }

    super.step(state)
    this.updateEntities()
  }

  /**
   *
   */
  async start() {
    this.assertStartupActive()
    lll('Client: Starting')

    await this.scene.start()
    if (this.stopped) {
      this.scene.stop()
      this.assertStartupActive()
    }

    await super.start()
    //await this.connect()

    this.events.emit(`Client:Started`, `default`)

    //this.gameEngine.once('renderer.ready', () => {
    //  Game input
    /*if (Utils.isTouchDevice()){
        this.controls = new MobileControls(this.renderer);
      } else {*/
    //this.controls = new Lance.KeyboardControls(this)
    //}

    //play sound when user fire missle
    // this.events.on(`fireMissile`, () => {
    //   lll(`fireM`)
    //
    //   if (this.renderer.scene) {
    //     //this.renderer.scene.soundFX_lasergun.play();
    //   }
    //})
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async connect(options: Record<string, unknown> = {}) {
    lll('Client: Joining server')
    const config = this.gameEngine.getConfig(`client`)
    this.options.serverURL = config.serverURL as string
    await super.connect(options)

    await this.joinServer({ login: { user: 'test', password: 'test' } })
  }

  /**
   * Disconnect from game server
   * @returns {*}
   */
  disconnect() {
    return super.disconnect()
  }

  /**
   *
   * @param scene
   */
  onSceneCreated(scene: Scene) {
    this.events.emit(`Client:Created`, this)
  }

  /**
   *
   * @param map
   */
  onMapLoading(map: GameMap) {}

  /**
   *
   * @param map
   */
  onMapLoaded(map: GameMap) {

  }

  /**
   *
   * @param entity
   */
  onObjectAdded(entity: Entity) {
    this.guiManager.addEntityBubble(entity)
  }

  /**
   *
   * @param entity
   */
  onObjectUpdated(entity: Entity) {

  }

  /**
   *
   * @param gameObject
   */
  onObjectClick(gameObject: Record<string, unknown>) {
    if (!gameObject) return
    if (isRecord(gameObject.data) && gameObject.data.scriptOff === true) return
    if (this.options.standaloneMode === true) {
      if (isRecord(gameObject.data) && ['Tile', 'Facade'].includes(gameObject.data.type as string)) {
        this.movePlayerTo(gameObject.data.location as Location | number[]).catch(error => {
          this.events.emit('Player:MovementRejected', errorMessage(error))
          console.warn(errorMessage(error))
        })
      } else if (this.authority && isRecord(gameObject.data) && typeof gameObject.data.sourcePath === 'string' &&
          this.getInteractionTarget(gameObject.data.sourcePath)) {
        const targetId = gameObject.data.sourcePath
        if (this.getInteractionTarget(targetId)?.kind === 'ground') this.pickupGroundItem(targetId).catch(() => {})
        else if (this.getInteractionTarget(targetId)?.kind === 'conversation') this.beginConversation(targetId).catch(() => {})
        else this.useTarget(targetId).catch(() => {})
      }
      return
    }
    lll(gameObject)
    if (isRecord(gameObject.data)) {
      let data = gameObject.data

      const isObject = Utils.isUndefined(data.type)
      if (isObject) {
        this.sendCommand(`Player:EntitySelect`, { entity: data })
      } else {
        this.sendCommand(`Player:TileSelect`, { tile: data })
      }

      if (data.type !== `Tile`) {
        this.guiManager.addDatGui(data)
      }
    } else {
      this.guiManager.addDatGui(gameObject)
    }
  }

  /**
   *
   * @param map
   * @param location
   * @returns {Promise<void>}
   */
  async addPlayer(location: Location) {
    let player = await this.world.addPlayer(location)
    this.player = player as RenderedPlayer

    this.events.emit(`Player:Joined`, player)
  }

  /**
   *
   * @param path
   * @param command
   */
  sendCommand(path: string | string[], command: Record<string, unknown>) {
    lll(`Client: Sending command`, path, command)

    let result = this.evaluateCommand(path, command)
    let {source, name, action, data} = result

    if (action) {
      this.sendRequest(action, data!)
    }

    this.events.emit(`${source}.Command`, {
      type: name,
      command
    })
  }

  /**
   *
   * @param name
   * @param logics
   */
  addCommandEvaluators(name: string, logics: Record<string, new (options: { engine: ClientEngine }) => { onCommand(command: Record<string, unknown>): { action?: string; data?: unknown } }>) {
    let instances = new Map()
    for (let name in logics) {
      let classType = logics[name]
      instances.set(name, new classType({ engine: this }))
    }

    this.commandEvaluators.set(name, instances)
  }

  /**
   *
   * @param path
   * @param command
   * @returns {{source: string, name: string, action: *, data: *}}
   */
  evaluateCommand(path: string[] | string, command: Record<string, unknown>) {
    if (typeof path === 'string') {
      path = path.split(`:`)
    }

    let source = path[0]
    let name = path[1]

    let evaluators = this.commandEvaluators.get(source)!

    let evaluator = evaluators.get(name)!

    let result = evaluator.onCommand(command)

    lle(`command`, { command, result })
    return {source, name, action: result.action, data: result.data}
  }

  /**
   *  handle a message that has been received from the server
   * @param syncData
   */
  handleInboundMessage(syncData: Record<string, unknown>) {
    let buffer = Uint8Array.from(syncData.dataBuffer as ArrayLike<number>)
    syncData.dataBuffer = buffer.buffer
    super.handleInboundMessage(syncData)
  }

  // emit an input to the authoritative server
  handleOutboundInput() {
    super.handleOutboundInput()
  }

  /**
   *
   * @param name
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenUI<T extends unknown[]>(name: string, listener: (...args: T) => unknown, context?: object) {
    return this.events.on(`ui.${name}`, listener, context)
  }

  /**
   *
   * @param name
   * @param listener
   * @param context
   * @returns {EventEmitter}
   */
  listenOnceUI<T extends unknown[]>(name: string, listener: (...args: T) => unknown, context?: object) {
    return this.events.once(`ui.${name}`, listener, context)
  }

  /**
   *
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitUI(name: string, ...args: unknown[]) {
    return this.events.emit(`ui.${name}`, ...args)
  }

  /**
   *
   * @param key
   * @param type
   * @param options
   * @param target
   * @returns {Promise<Object>}
   */
  async loadAsset(
    key: string,
    type: string,
    options: Record<string, unknown>,
    target?: AssetTarget | null
  ): Promise<AssetDescriptor | null> {

    let descriptor = this.assetLoader.getCachedAsset(key)
    if (descriptor) {
      return descriptor
    }

    descriptor = Utils.merge(options, { key, type }) as AssetDescriptor

    let loaded = await this.assetLoader.loadAsset(descriptor, target)
    if (!loaded) {
      return null
    }

    switch (descriptor.type) {
      case `atlas`: {
        break
      }
      case `shader`: {

        break
      }
    }

    return descriptor
  }

  /**
   *
   * @param art
   */
  getGfxPath(art: Record<string, unknown>) {
    return GfxPathBuilder.build(art)
  }

}
