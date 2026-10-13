import type Trace from '../../shared/misc/Trace'
import type StepState from '../../shared/StepState'
export interface SyncOptions { sync?: string; reflect?: boolean; verbose?: boolean; localObjBending?: number; remoteObjBending?: number; bendingIncrements?: number; maxReEnactSteps?: number }
/** The historical snapshot synchronizers predate the local intention protocol.
 * Their object-world contract remains isolated from the active authority. */
export interface SyncObject {
  id: string
  playerId?: number | string
  syncTo(other: SyncObject): void
  saveState(other?: SyncObject): void
  bendToCurrentState(amount: number, settings: unknown, local: boolean, increments: number): void
  bendingToString(): string
  applyIncrementalBending?(state: StepState): void
  refreshToPhysics(): void
  refreshRenderObject?(): void
}
export interface SyncEvent { eventName: string; stepCount: number; objectInstance?: SyncObject }
export interface ObjectSyncEvent extends SyncEvent { objectInstance: SyncObject }
export interface SyncBatch { stepCount: number; fullUpdate: boolean; required?: boolean; syncObjects: Record<string, ObjectSyncEvent[]>; syncSteps: Record<number, Record<string, SyncEvent[]>> }
export interface SyncReceived { stepCount: number; fullUpdate: boolean; syncEvents: SyncEvent[] }
export interface LegacySyncWorld { stepCount: number; objects: Record<string, SyncObject>; getDynamicEntity(id: string): SyncObject | undefined; getDynamicEntities(): Map<string, SyncObject> }
export interface LegacySyncEngine {
  trace: { debug(message: () => string): void; info(message: () => string): void; trace(message: () => string): void; warn(message: () => string): void }
  events: { on<T extends unknown[]>(name: string, listener: (...args: T) => unknown): unknown }
  world: LegacySyncWorld
  options: { clientIDSpace: number }
  playerId: number | string
  worldSettings: unknown
  ignoreInputs: boolean
  ignorePhysics: boolean
  addDynamicEntityToWorld(entity: SyncObject): void
  removeDynamicEntityFromWorld(id: string): void
  removeObjectFromWorld(id: string): void
  findLocalShadow(entity: SyncObject): SyncObject | null | undefined
  processCommand(input: LegacyInput, playerId: number | string): void
  step(reenact: boolean): void
}
export interface LegacySyncClient { gameEngine: unknown; world: LegacySyncWorld; options: { verbose?: boolean } }
export interface LegacyInput { step: number; messageIndex: number; input?: unknown; options?: { movement?: boolean } }
