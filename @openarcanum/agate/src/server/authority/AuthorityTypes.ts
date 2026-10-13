import type Location from '../../shared/Location'

export type Position = [number, number]
export interface Flags extends Iterable<string> { has(flag: string): boolean; hasAny(flags: string[]): boolean }
export interface InventoryEntry { id: string; slot: number }
export interface InventoryComponent { inventory: InventoryEntry[]; inventoryIndex: number; inventorySource: number }
export interface CritterComponent extends InventoryComponent { progressionSupported?: boolean }
export interface ContainerComponent extends InventoryComponent { flags: Flags; keyId: number; keyUseSupported?: boolean }
export interface PortalComponent { flags: Flags; keyID: number; keyUseSupported?: boolean }
export interface ItemComponent { parent: string | null; invLocation: number; flags: Flags; groundTransferSupported?: boolean; magicTechComplexity?: number; descriptionUnknown?: number; weight?: number; magicWeightAdj?: number }
export interface VisualFrame { type?: string; category?: string; subcat?: string; number?: number; display?: string; stage?: string | number; side?: number; frame?: number }
export interface VisualComponent { getCurrent(): VisualFrame }
export interface NpcComponent { conversationSupported?: boolean; conversationId?: string }
/** Components used by the authority's reviewed simulation policies. Optional
 * ECS components are refined before their records enter the authority ledger. */
export interface AuthorityEntity {
  id: string
  sourcePath: string
  map: AuthorityMap
  base: { type: string; prototype: number; location: Location; flags: Flags; descIndex?: number }
  item?: ItemComponent
  critter?: CritterComponent
  container?: ContainerComponent
  portal?: PortalComponent
  visual?: VisualComponent
  npc?: NpcComponent
  key?: { keyId: number }
  ammo?: { quantity: number }
  gold?: { quantity: number }
  ground?: boolean
  portalOpen?: boolean
}
export interface ItemEntity extends AuthorityEntity { item: ItemComponent }
export interface ActorEntity extends AuthorityEntity { critter: CritterComponent }
export interface DoorEntity extends AuthorityEntity { portal: PortalComponent; visual: VisualComponent }
export interface ContainerEntity extends AuthorityEntity { container: ContainerComponent }
export interface NpcEntity extends ActorEntity { npc: NpcComponent }
export interface AuthorityTile {
  type?: string
  blocked?: boolean
  Pc?: Record<string, AuthorityEntity>
  [component: string]: string | boolean | Record<string, AuthorityEntity> | undefined
}
export interface AuthorityMap {
  width: number
  height: number
  entityManager: { entities: Map<string, AuthorityEntity> }
  pathFind: { findPath(origin: Location, target: Location): Location[] }
  getTile(x: number, y: number): AuthorityTile | undefined
  isTileBlocked(location: Location): boolean
  isTileBlocked(x: number, y: number): boolean
  moveEntity(entity: AuthorityEntity, origin: Location, target: Location): void
  getStartLocation(): Location
}
export interface Failure { code: string; message: string }
export type Outcome<T extends object> = (T & { code?: undefined; message?: undefined }) | Failure
export type OwnWrite = [object: object, key: PropertyKey, value: unknown]
export interface Transaction { apply(): void; rollback(): void }
export interface PendingUse { targetId: string; entity: AuthorityEntity; location: Position; expectedOpen?: boolean; signature?: string }
export interface PreparedUse { path: Position[]; pending: PendingUse }
export interface UseResult { result: { kind?: string; targetId: string; open?: boolean } }
export function failure(code: string, message: string): Failure { return { code, message } }
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
export function exactKeys<K extends string>(value: unknown, keys: readonly K[]): value is Record<K, unknown> {
  return record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
export function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) }
export function validPosition(value: unknown): value is Position { return Array.isArray(value) && value.length === 2 && value.every(integer) }
export const position = (entity: AuthorityEntity): Position => [entity.base.location.x, entity.base.location.y]
export const samePosition = (a: Position, b: Position): boolean => a[0] === b[0] && a[1] === b[1]
export const near = (a: Position, b: Position): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1
export const errorCode = (error: unknown): unknown => record(error) ? error.code : undefined
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)
