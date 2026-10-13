import type { CharacterAttribute, CharacterState, ConversationState, JournalState } from '../../@openarcanum/agate/src/client/SessionTypes'
import type { DesktopBridge as FullDesktopBridge } from '../../ember-electron/desktop-contracts.cjs'
export type { CharacterAttribute as AttributeRow, CharacterState, ConversationState, JournalState }

/** The UI consumes validated client views, never the server's mutable ledger. */
export interface RuntimeConfig {
  dataPath?: string
  scriptsPath?: string
  moduleId?: string
  moduleManifestPath?: string
  developmentMap?: string
}

export interface DataStatus {
  ready: boolean
  dataPath: string
  message: string
  mapId?: string
  moduleId?: string
  ownedModule?: boolean
}

export interface DataFileSystem {
  existsSync(path: string): boolean
  statSync(path: string): { isDirectory(): boolean }
  readdirSync(path: string): string[]
  readFileSync(path: string, encoding: 'utf8'): string
}

export interface DataPaths { join(...parts: string[]): string }

export interface DesktopRequire {
  (name: 'node:fs'): DataFileSystem
  (name: 'node:path'): DataPaths
  (name: '@openarcanum/agate'): RuntimeConstructor | { default: RuntimeConstructor }
  (name: string): unknown
}

export type DesktopBridge = Pick<FullDesktopBridge, 'config' | 'startLocalServer' | 'stopLocalServer'>
export type LocalAuthoritySession = Awaited<ReturnType<DesktopBridge['startLocalServer']>>

export interface DisplayTarget { id: string; label?: string; reason?: string }
export interface DoorTarget extends DisplayTarget { open: boolean; locked?: boolean }
export interface ContainerTarget extends DisplayTarget { locked?: boolean }
export interface ItemRow extends DisplayTarget { label: string; quantity: number; type: string; canDrop?: boolean }

export interface OperationState { status: string; message: string }
export interface InteractionState extends OperationState {
  kind?: 'door' | 'container' | 'ground' | 'conversation'
  targetId: string
  inspected?: boolean
  canTake?: boolean
  canPut?: boolean
  items?: ItemRow[]
}
export interface InventoryState extends OperationState { known: boolean; items: ItemRow[] }
export interface GroundState extends OperationState { action?: 'drop' | 'pickup'; targetId?: string }
export interface PauseState extends OperationState { paused?: boolean; supported?: boolean; moving?: boolean }
export interface CheckpointState extends OperationState { action?: 'save' | 'load'; savedAt?: string }

export interface ClientEvents {
  'Game:Error': Error
  'World:InteractionsUpdated': DoorTarget[]
  'World:ContainersUpdated': ContainerTarget[]
  'World:GroundItemsUpdated': ItemRow[]
  'World:ConversationTargetsUpdated': DisplayTarget[]
  'Player:InteractionUpdated': InteractionState | null
  'Player:CheckpointUpdated': CheckpointState | null
  'Player:PauseUpdated': PauseState | null
  'Player:InventoryUpdated': InventoryState | null
  'Player:GroundUpdated': GroundState | null
  'Player:ConversationUpdated': ConversationState | null
  'Player:JournalUpdated': JournalState | null
  'Player:CharacterUpdated': CharacterState | null
}

export interface ClientEventBus {
  on<K extends keyof ClientEvents>(name: K, callback: (value: ClientEvents[K]) => void): void
  off<K extends keyof ClientEvents>(name: K, callback: (value: ClientEvents[K]) => void): void
}

export interface GameClient {
  events: ClientEventBus
  guiManager: import('./widgets').GuiManager
  player?: { id: string }
  authorityState?: {
    doors?: DoorTarget[]
    containers?: ContainerTarget[]
    groundItems?: ItemRow[]
    conversationTargets?: DisplayTarget[]
    pause?: { paused?: boolean; supported?: boolean }
    checkpoint?: { supported?: boolean }
    actors?: { id: string; movement?: unknown }[]
  }
  interactionState?: InteractionState
  checkpointState?: CheckpointState
  pauseState?: PauseState
  inventoryState?: InventoryState
  groundState?: GroundState
  conversationState?: ConversationState
  journalState?: JournalState
  characterState?: CharacterState
  useTarget(targetId: string): Promise<unknown>
  takeAllItems(targetId: string): Promise<unknown>
  takeItem(targetId: string, itemId: string): Promise<unknown>
  putItem(targetId: string, itemId: string): Promise<unknown>
  pickupGroundItem(itemId: string): Promise<unknown>
  dropItem(itemId: string): Promise<unknown>
  beginConversation(targetId: string): Promise<unknown>
  replyConversation(optionId: string): Promise<unknown>
  closeConversation(): void
  refreshJournal(): Promise<unknown>
  refreshCharacter(): Promise<unknown>
  spendCharacterPoint(statId: string): Promise<unknown>
  saveCheckpoint(): Promise<{ savedAt: string }>
  loadCheckpoint(): Promise<{ savedAt: string }>
  setPaused(paused: boolean): Promise<unknown>
  getGfxPath(art: unknown): string
  emitUI(name: string, ...args: unknown[]): void
  listenUI(name: string, callback: (...args: unknown[]) => unknown, context?: unknown): void
  listenOnceUI(name: string, callback: (...args: unknown[]) => unknown, context?: unknown): void
  stop(): void
}

export interface GameEngine {
  client?: GameClient
  database?: unknown
  createClient(canvas: HTMLCanvasElement, options: {
    standaloneMode: true
    moduleId?: 'inventory-workshop'
    authoredGui?: false
    mapId?: string
    authoritySession: LocalAuthoritySession
    signal: AbortSignal
  }): Promise<GameClient>
}

export interface RuntimeUtils {
  [key: PropertyKey]: unknown
  loadScripts(path: string, callback: (name: string, definition: import('./widgets').WidgetDefinition) => void): void
  objectToJson(value: unknown): string
  jsonToObject<T = unknown>(value: string): T
  logError(...values: unknown[]): void
  isFunction(value: unknown): value is (...args: unknown[]) => unknown
  isNumber(value: unknown): value is number
  isString(value: unknown): value is string
  isArray(value: unknown): value is unknown[]
  isUndefined(value: unknown): value is undefined
  isObjectLike(value: unknown): value is object
  clamp(value: number, minimum: number, maximum: number): number
}
export interface AGateRuntime {
  Utils: RuntimeUtils
  engine?: GameEngine
  getGfxUrl(path: string): string
  getAppUrl(path: string): string
  createEngine(): GameEngine
}
export interface RuntimeConstructor { new(configuration: RuntimeConfig): AGateRuntime }

declare global {
  var requireNode: DesktopRequire | undefined
  var AGate: AGateRuntime | undefined
  var openArcanumDesktop: DesktopBridge | undefined
  interface Window {
    requireNode?: DesktopRequire
    AGate?: AGateRuntime
    openArcanumDesktop?: DesktopBridge
  }
}
