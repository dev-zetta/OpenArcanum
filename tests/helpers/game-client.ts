/** Mutable, deliberately partial replicas used to exercise the view in isolation.
 * Events accept unknown payloads so rejection and redaction tests can inject
 * incomplete/untrusted messages without pretending they passed wire validation. */
export interface FixtureItem {
  id: string; label: string; type: string; slot?: number; prototypeId?: number; quantity?: number
  canDrop?: boolean; reason?: string; location?: number[]; kind?: string
}
export interface FixtureTarget {
  id: string; label: string; kind?: string; open?: boolean; locked?: boolean; usable?: boolean; reason?: string
  items?: unknown[]; location?: number[]; text?: string; options?: { id: string; text: string }[]
}
export interface FixtureCharacter {
  status: string; supported: boolean; message: string; revision?: number
  experiencePoints?: number; level?: number; unspentPoints?: number; nextLevelExperience?: number | null
  attributes?: FixtureAttribute[]; derived?: Record<string, number>
}
export interface FixtureAttribute { id: string; label: string; value: number; maximum: number; pointCost: number; canIncrease: boolean; reason?: string }
export interface FixtureClient {
  events: {
    on(name: string, callback: (value: unknown) => void): void
    off(name: string, callback: (value: unknown) => void): void
    emit(name: string, value: unknown): void
  }
  authorityState: {
    doors: FixtureTarget[]
    containers?: FixtureTarget[]
    groundItems?: FixtureItem[]
    conversationTargets?: FixtureTarget[]
    pause?: { supported: boolean; paused: boolean; moving?: boolean }
    checkpoint?: { supported: boolean; busy: boolean }
  }
  guiManager: { setRootWidget(): void; setMouseSprite(): void }
  emitUI(): void
  stop(): void
  useTarget(targetId: string): unknown
  inventoryState?: { status: string; known: boolean; ownerId: string; items: Partial<FixtureItem>[]; message: string }
  conversationState?: { status: string; message: string; targetId?: string; revision?: number; speaker?: string; text?: string; options?: { id: string; text: string }[] }
  journalState?: { status: string; message: string; entries: { id?: string; title: string; text?: string; status?: string }[] }
  characterState?: FixtureCharacter
  saveCheckpoint?(): unknown
  loadCheckpoint?(): unknown
  takeItem?(targetId: string, itemId: string): unknown
  putItem?(targetId: string, itemId: string): unknown
  takeAllItems?(targetId: string): unknown
  pickupGroundItem?(targetId: string): unknown
  dropItem?(itemId: string): unknown
  beginConversation?(targetId: string): unknown
  replyConversation?(optionId: string): unknown
  refreshJournal?(): unknown
  closeConversation?(): void
  refreshCharacter?(...args: unknown[]): unknown
  spendCharacterPoint?(...args: unknown[]): unknown
  setPaused?(paused: boolean): unknown
}
export type TargetAction = (client: FixtureClient, targetId: string) => unknown
export type ItemAction = (client: FixtureClient, targetId: string, itemId: string) => unknown
export type ClientAction = (client: FixtureClient) => unknown
export type ArgsAction = (client: FixtureClient, args: unknown[]) => unknown
