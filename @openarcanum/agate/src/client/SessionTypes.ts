import type { InventoryState } from './PrivateInventoryTypes'
import type { AttributeId, DerivedNeutralStats } from '../shared/character/NeutralStats'

export interface CharacterAttribute {
  id: AttributeId
  label: string
  value: number
  maximum: 20
  pointCost: 1
  canIncrease: boolean
  reason?: string
}

export interface SupportedCharacterView {
  kind: 'character'
  supported: true
  experiencePoints: number
  level: number
  unspentPoints: number
  nextLevelExperience: number | null
  attributes: CharacterAttribute[]
  derived: DerivedNeutralStats
}

export interface UnsupportedCharacterView { kind: 'character'; supported: false }
export type CharacterView = SupportedCharacterView | UnsupportedCharacterView
export type CharacterState =
  | (SupportedCharacterView & { status: 'ready'; revision: number; message: string })
  | { status: 'unavailable' | 'stale' | 'pending' | 'rejected'; supported: false;
      kind?: 'character'; revision?: number; message: string }

export interface CharacterRequest {
  action: 'read' | 'buy-attribute'
  revision?: number
  commandId?: number
  promise?: Promise<CharacterState | null>
}

export interface ConversationOption { id: string; text: string }
export interface QuestEntry { id: string; title: string; status: 'active' | 'completed'; text: string }
export interface JournalState {
  status: 'ready' | 'pending' | 'stale' | 'rejected'
  message: string
  revision?: number
  entries: QuestEntry[]
}
export interface ConversationTarget { id: string; kind: 'conversation'; label: string; location: [number, number] }
interface ConversationDetails {
  targetId?: string
  speaker?: string
  revision?: number
  conversationId?: string
  nodeId?: string
  text?: string
  message: string
  options: ConversationOption[]
}
export type ConversationState =
  | (ConversationDetails & { status: 'ready'; targetId: string; revision: number;
      conversationId: string; nodeId: string; speaker: string; text: string })
  | (ConversationDetails & { status: 'pending' | 'closed' | 'stale' | 'rejected' })
export interface ConversationRequest {
  action: 'talk' | 'reply'
  phase: 'approach' | 'command'
  epoch: number
  revision?: number
  commandId?: number
}
export interface JournalRequest { revision: number; promise?: Promise<JournalState | null> }
export interface ActorCommand { id: number; type?: string; status: string }
export interface SessionActor { lastCommand?: ActorCommand | null }
export interface SessionSnapshot { revision: number; conversationTargets?: unknown }

/** Only the private command surface consumed by these sessions. Wire replies
 * remain unknown until the corresponding session has validated their shape. */
export interface SessionAuthority {
  nextId: number
  character(actorId: string): Promise<unknown>
  buyAttribute(actorId: string, statId: string, revision: number): Promise<unknown>
  talk(actorId: string, targetId: string): Promise<unknown>
  reply(actorId: string, targetId: string, conversationId: string, optionId: string, revision: number): Promise<unknown>
  journal(actorId: string): Promise<unknown>
}

export interface SessionClient {
  stopped: boolean
  ready: boolean
  player: { id: string }
  authority: SessionAuthority
  authorityState: { revision: number; conversationTargets?: ConversationTarget[] }
  events: { emit(event: string, value: unknown): unknown }
  inventoryState?: InventoryState | null
  readPrivateInventory?(value: unknown, revision: number): InventoryState
  setInventoryState?(state: InventoryState): void
  refreshInventory?(): Promise<InventoryState | null | undefined>
  invalidateInventory?(message?: string): void
  characterState: CharacterState | null
  conversationState: ConversationState | null
  journalState: JournalState | null
  characterRequest: CharacterRequest | null
  conversationRequest: ConversationRequest | null
  journalRequest: JournalRequest | null
  assertAuthorityCommandReady(options?: { allowPaused?: boolean }): void
  invalidateConversation(): void
  clearContainerInspection(): void
  useTarget(targetId: string, options: { conversationAction: true }): Promise<unknown>
  getCharacterSession(): { apply(view: unknown, revision: number): CharacterState | null }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
