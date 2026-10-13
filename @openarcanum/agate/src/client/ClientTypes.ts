import type { PrivateItem, InventoryState } from './PrivateInventoryTypes'
export type { PrivateItem, InventoryState } from './PrivateInventoryTypes'
import type Location from '../shared/Location'
import type { Position } from '../server/authority/AuthorityTypes'

export interface GroundItem { id: string; kind: string; label: string; type: string; prototypeId: number; location: Position }
export interface InteractionTarget { id: string; kind: string; label: string; location: number[]; open?: boolean; locked?: boolean; usable?: boolean; reason?: string; closedFrame?: number; openFrame?: number }
export interface PublicCommand { id: number; type?: string; status: string; code?: string; message?: string; result?: ResponsePayload }
export interface SnapshotMovement { commandId: number; path: Position[]; index: number; elapsedMs: number; durationMs: number; progress: number }
export interface SnapshotActor { id: string; location: Position; movement?: SnapshotMovement | null; lastCommand?: PublicCommand | null }
export interface AuthoritySnapshot { version: number; revision: number; mapId: string; serverTime?: number; actors: SnapshotActor[]; doors?: InteractionTarget[]; containers?: InteractionTarget[]; groundItems?: GroundItem[]; conversationTargets?: import('./SessionTypes').ConversationTarget[]; pause?: { supported: boolean; paused: boolean }; checkpoint?: { supported: boolean; busy: boolean; lastAction?: string; savedAt?: string; error?: { code?: string; message: string } } }
export interface ResponsePayload { kind: string; targetId?: string; itemId?: string; itemIds?: string[]; items?: unknown; carrying?: unknown; ownerId?: string; inventory?: { ownerId: string; items: unknown; carrying?: unknown }; ground?: unknown; open?: boolean; paused?: boolean; savedAt?: string; character?: unknown }
export interface CommandAck { ok: true; version: number; id: number; actorId: string; status: string; revision: number; targetId?: string; path?: Position[]; result?: ResponsePayload }
export interface MovementAck extends CommandAck { path: Position[] }
export interface JoinAck { ok: true; version: number; role: 'owner'; mapId: string; actorId: string; nextCommandId: number; snapshot: AuthoritySnapshot }
export interface AuthoritySession { protocolVersion: number; url: string; token: string; pid?: number }
export interface InteractionState { targetId: string; kind: string; label: string; status: string; message: string; open?: boolean; locked?: boolean; inspected?: boolean; items?: PrivateItem[]; revision?: number | null; canTake?: boolean; canPut?: boolean }
export interface MovementCompletion { path: Position[]; commandId?: number; approachCommandId?: number; result?: ResponsePayload }
export interface PendingMovement { path: Position[] | Location[]; index?: number; elapsed?: number; commandId?: number; type?: string; targetId?: string; finishing?: boolean; resolve(value: MovementCompletion): void; reject(reason: unknown): void }
export interface ActionRequest { action: string; epoch?: number; commandId?: number; targetId?: string; paused?: boolean }
export interface InventoryRequest { epoch: number; promise?: Promise<InventoryState | null> }
export interface CheckpointCompletion { commandId: number; kind: string; savedAt: string }
export interface CheckpointPending { action: string; commandId: number; finishing?: boolean; resolve(value: CheckpointCompletion): void; reject(reason: unknown): void }
export interface PauseCompletion { commandId: number; kind: string; paused: boolean }
export interface PausePending { action: string; paused: boolean; commandId: number; revision: number; timer?: ReturnType<typeof setTimeout>; resolve(value: PauseCompletion): void; reject(reason: unknown): void }
export interface ActionState { action: string; status: string; message: string; savedAt?: string }
export interface PauseState { supported: boolean; paused: boolean; moving: boolean; status: string; message?: string }
export interface OfflineMovement { path: Location[]; index: number; elapsed: number; resolve(value: MovementCompletion): void; reject(reason: unknown): void }
export const errorCode = (error: unknown): unknown => error && typeof error === 'object' && 'code' in error ? error.code : undefined
