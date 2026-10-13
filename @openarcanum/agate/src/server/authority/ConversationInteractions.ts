import { failure as error, exactKeys, record, integer, position, near, samePosition as same, errorCode, errorMessage, type AuthorityMap, type AuthorityEntity, type NpcEntity, type Position, type PendingUse, type PreparedUse, type UseResult, type Outcome, type OwnWrite, type Transaction } from './AuthorityTypes'
import type InventoryOwnership from './InventoryOwnership'
import type CharacterProgression from './CharacterProgression'
import type { QuestState } from './CharacterProgression'
import { randomBytes } from 'node:crypto'
import Location from '../../shared/Location'
import { prepareOwnWrites } from './InventoryOwnership'
import { MAX_QUEST_EXPERIENCE } from './CharacterProgression'

const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit &&
  !/[\x00-\x08\x0b-\x1f\x7f]/.test(value)
const id = (value: unknown): value is string => text(value, 128) && /^[A-Za-z0-9_-]+$/.test(value)
const targetId = (value: unknown): value is string => text(value, 1024) && !/[\x00-\x1f]/.test(value)
const HIDDEN_FLAGS = ['Off', 'Destroyed', 'DontDraw', 'Inventory']
const STAGES = ['offer', 'active', 'completed'] as const
const STATUS_NODE = { absent: 'offer', active: 'active', completed: 'completed' } as const

type Stage = typeof STAGES[number]
interface QuestDefinition { id: string; title: string; activeText: string; completedText: string; rewardExperience: number }
interface Quest { definition: Readonly<QuestDefinition>; status: QuestState['status']; completionAttainable?: boolean }
interface DialogueOption { id: string; text: string; effect: 'close' | 'start' | 'complete'; condition?: Readonly<{ kind: 'held-item'; itemId: string }> }
interface DialogueNode { id: Stage; text: string; options: readonly DialogueOption[] }
interface ConversationTarget { id: string; entity: NpcEntity; npc: NpcEntity['npc']; prototypeId: number; marker?: boolean; conversationId: string; questId: string; label: string; nodes: Map<Stage, DialogueNode> }
interface ActiveConversation { conversationId: string; targetId: string; socket: object; actor: AuthorityEntity; nodeId: Stage; status: QuestState['status']; location: Position; options: Set<string> }
export interface ReplyCommand { conversationId: string; targetId: string; optionId: string }
export interface DialogueResult { kind: string; targetId: string; closed: boolean; conversationId?: string; nodeId?: Stage; speaker?: string; text?: string; options?: { id: string; text: string }[]; journal: ReturnType<ConversationInteractions['journal']>; character: ReturnType<CharacterProgression['view']> }
const stage = (value: unknown): value is Stage => typeof value === 'string' && STAGES.some(stage => stage === value)
/** A deliberately finite authored conversation format, separate from original
 * DLG scripts. No expressions, script hooks or arbitrary effects run. Authored
 * XP rewards share the quest transaction; item rewards remain unsupported.
 * Dialogue sessions, character state and journal text stay owner-private. */
export default class ConversationInteractions {
  declare map: AuthorityMap
  declare ownership: InventoryOwnership
  declare targets: Map<string, ConversationTarget>
  declare quests: Map<string, Quest>
  declare active: ActiveConversation | null
  declare turn: number
  declare sessionPrefix: string
  declare progression: CharacterProgression | undefined
  constructor(map: AuthorityMap, ownership: InventoryOwnership, document: unknown = null, { progression }: { progression?: CharacterProgression } = {}) {
    this.map = map
    this.ownership = ownership
    this.targets = new Map()
    this.quests = new Map()
    this.active = null
    this.turn = 0
    this.sessionPrefix = randomBytes(16).toString('hex')
    this.progression = progression
    this.load(document)
    this.progression?.bindQuests(this.quests)
  }

  load(document: unknown) {
    const entities = [...this.map.entityManager.entities.values()].filter(entity => entity.map === this.map)
    const marked = entities.filter(entity => entity.npc?.conversationSupported === true)
    if (document === null || document === undefined) {
      if (marked.length) throw new Error('Authored NPC conversation rules are missing')
      return
    }
    const invalid: () => never = () => { throw new Error('Authored conversation rules are invalid or unsupported') }
    if (!exactKeys(document, ['version', 'quests', 'conversations']) || document.version !== 1 ||
        !Array.isArray(document.quests) || document.quests.length > 64 ||
        !Array.isArray(document.conversations) || document.conversations.length > 64) invalid()
    for (const quest of document.quests) {
      const hasReward = Object.hasOwn(quest || {}, 'rewardExperience')
      if (!exactKeys(quest, ['id', 'title', 'activeText', 'completedText', ...(hasReward ? ['rewardExperience'] : [])]) || !id(quest.id) ||
          !text(quest.title, 128) || !text(quest.activeText, 2048) || !text(quest.completedText, 2048) ||
          (hasReward && (!integer(quest.rewardExperience) || quest.rewardExperience < 0 || quest.rewardExperience > MAX_QUEST_EXPERIENCE)) ||
          this.quests.has(quest.id)) invalid()
      this.quests.set(quest.id, { definition: Object.freeze({ id: quest.id, title: quest.title, activeText: quest.activeText, completedText: quest.completedText, rewardExperience: (quest.rewardExperience as number | undefined) || 0 }), status: 'absent' })
    }
    const conversationIds = new Set(), questIds = new Set()
    for (const conversation of document.conversations) {
      if (!exactKeys(conversation, ['id', 'targetId', 'label', 'questId', 'nodes']) || !id(conversation.id) ||
          !targetId(conversation.targetId) || !text(conversation.label, 128) || !id(conversation.questId) ||
          !this.quests.has(conversation.questId) || conversationIds.has(conversation.id) ||
          questIds.has(conversation.questId) || this.targets.has(conversation.targetId) ||
          !Array.isArray(conversation.nodes) || conversation.nodes.length !== STAGES.length) invalid()
      const matching = entities.filter(entity => entity.sourcePath === conversation.targetId)
      const entity = matching[0]
      if (matching.length !== 1 || !this.isNpc(entity) || entity.npc.conversationSupported !== true ||
          entity.npc.conversationId !== conversation.id) invalid()
      const nodes = new Map<Stage, DialogueNode>()
      for (const node of conversation.nodes) {
        if (!exactKeys(node, ['id', 'text', 'options']) || !stage(node.id) || nodes.has(node.id) ||
            !text(node.text, 2048) || !Array.isArray(node.options) || !node.options.length || node.options.length > 5) invalid()
        const optionIds = new Set<string>(), options: DialogueOption[] = []
        for (const option of node.options) {
          const conditional = option.effect === 'complete'
          if (!exactKeys(option, ['id', 'text', 'effect', ...(conditional ? ['condition'] : [])]) ||
              !id(option.id) || optionIds.has(option.id) || !text(option.text, 512) ||
              !(option.effect === 'close' || (node.id === 'offer' && option.effect === 'start') ||
                (node.id === 'active' && conditional))) invalid()
          if (conditional) {
            const condition = option.condition
            const item = this.ownership.items.get(record(condition) && typeof condition.itemId === 'string' ? condition.itemId : '')
            if (!exactKeys(condition, ['kind', 'itemId']) || condition.kind !== 'held-item' ||
                !targetId(condition.itemId) || !item || item.type !== 'Generic') invalid()
          }
          optionIds.add(option.id)
          options.push(Object.freeze({ id: option.id, text: option.text, effect: option.effect as DialogueOption['effect'],
            ...(conditional ? { condition: Object.freeze({ ...(option.condition as { kind: 'held-item'; itemId: string }) }) } : {}) }))
        }
        if (!options.some(option => option.effect === 'close') ||
            (node.id !== 'completed' && !options.some(option => option.effect === (node.id === 'offer' ? 'start' : 'complete')))) invalid()
        nodes.set(node.id, Object.freeze({ id: node.id, text: node.text, options: Object.freeze(options) }))
      }
      if (STAGES.some(stage => !nodes.has(stage))) invalid()
      const quest = this.quests.get(conversation.questId)!
      quest.completionAttainable = nodes.get('active')!.options.filter(option => option.effect === 'complete')
        .some(option => this.ownership.items.get(option.condition!.itemId)!.movable === true)
      this.targets.set(conversation.targetId, { id: conversation.targetId, entity, npc: entity.npc,
        prototypeId: entity.base.prototype, marker: entity.npc.conversationSupported,
        conversationId: conversation.id, questId: conversation.questId, label: conversation.label, nodes })
      conversationIds.add(conversation.id); questIds.add(conversation.questId)
    }
    if (questIds.size !== this.quests.size || marked.some(entity => !this.targets.has(entity.sourcePath))) invalid()
  }

  isNpc(entity: AuthorityEntity): entity is NpcEntity {
    return !!(entity?.map === this.map && entity.base?.type === 'Npc' && entity.npc && entity.critter &&
      !entity.base.flags.hasAny(HIDDEN_FLAGS))
  }

  present(state: ConversationTarget) {
    return this.map.entityManager.entities.get(state.entity.id) === state.entity && this.isNpc(state.entity) &&
      state.entity.sourcePath === state.id && state.entity.npc === state.npc &&
      state.entity.base.prototype === state.prototypeId && state.entity.npc.conversationSupported === state.marker &&
      state.entity.npc.conversationId === state.conversationId
  }

  snapshots() {
    return [...this.targets.values()].filter(state => this.present(state)).sort((a, b) => a.id.localeCompare(b.id))
      .map(state => ({ id: state.id, kind: 'conversation', label: state.label, location: position(state.entity) }))
  }

  prepare(targetId: string, actor: AuthorityEntity): Outcome<PreparedUse> {
    const state = this.targets.get(targetId)
    if (!state || !this.present(state)) return error('UNKNOWN_TARGET', 'No supported authored conversation target has that id')
    const location = position(state.entity), origin = position(actor)
    let path: Position[] | undefined
    if (near(origin, location)) path = [origin]
    else {
      for (const candidate of [[location[0] - 1, location[1]], [location[0], location[1] - 1],
        [location[0], location[1] + 1], [location[0] + 1, location[1]]]) {
        const route = this.map.pathFind.findPath(actor.base.location, new Location(candidate as Position)).map((point): Position => [point.x, point.y])
        if (route.length && (!path || route.length < path.length)) path = route
      }
    }
    if (!path) return error('NO_PATH', 'No walkable path reaches a cardinal neighbor of the conversation target')
    return { path, pending: { targetId, entity: state.entity, location } }
  }

  apply(pending: PendingUse, actor: AuthorityEntity): Outcome<UseResult> {
    const state = this.targets.get(pending.targetId)
    if (!state || !this.present(state) || state.entity !== pending.entity || !same(position(state.entity), pending.location)) {
      return error('TARGET_CHANGED', 'Conversation target changed or disappeared during the approach')
    }
    if (!near(position(actor), pending.location)) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the conversation target')
    return { result: { kind: 'conversation', targetId: state.id } }
  }

  target(targetId: string, actor: AuthorityEntity): Outcome<{ state: ConversationTarget }> {
    const state = this.targets.get(targetId)
    if (!state || !this.present(state)) return error('UNKNOWN_TARGET', 'No supported authored conversation target has that id')
    if (!near(position(actor), position(state.entity))) return error('OUT_OF_RANGE', 'Actor must reach a cardinal neighbor of the conversation target')
    return { state }
  }

  condition(option: DialogueOption): { code?: string; message?: string } {
    if (!option.condition) return {}
    try {
      this.ownership.validateCurrent()
      const inventory = this.ownership.actorInventory()
      if (inventory.code !== undefined) return inventory
      if (!inventory.items.some(item => item.id === option.condition!.itemId)) {
        return error('CONDITION_NOT_MET', 'Carry the requested workshop item to show it')
      }
      return {}
    } catch (_) { return error('INVENTORY_UNAVAILABLE', 'Item ownership could not be safely verified') }
  }

  journal() {
    this.checkpointStates()
    return { entries: [...this.quests.values()].filter(quest => quest.status !== 'absent')
      .sort((a, b) => a.definition.id.localeCompare(b.definition.id)).map(quest => ({
        id: quest.definition.id, title: quest.definition.title, status: quest.status,
        text: quest.status === 'completed' ? quest.definition.completedText : quest.definition.activeText })) }
  }

  issue(state: ConversationTarget, socket: object, actor: AuthorityEntity): DialogueResult {
    const status = this.quests.get(state.questId)!.status
    const node = state.nodes.get(STATUS_NODE[status])
    if (!node) throw new Error('Quest state is invalid')
    const options = node.options.filter(option => !this.condition(option).code)
    const conversationId = `${this.sessionPrefix}-${++this.turn}`
    this.active = { conversationId, targetId: state.id, socket, actor, nodeId: node.id,
      status, location: position(state.entity), options: new Set(options.map(option => option.id)) }
    return { kind: 'conversation', targetId: state.id, closed: false, conversationId, nodeId: node.id,
      speaker: state.label, text: node.text, options: options.map(option => ({ id: option.id, text: option.text })), journal: this.journal(),
      character: this.progression?.view() || { kind: 'character', supported: false } }
  }

  talk(targetId: string, socket: object, actor: AuthorityEntity): Outcome<{ result: DialogueResult; changed?: boolean }> {
    const target = this.target(targetId, actor)
    if (target.code !== undefined) return target
    return { result: this.issue(target.state, socket, actor) }
  }

  reply(command: ReplyCommand, socket: object, actor: AuthorityEntity): Outcome<{ result: DialogueResult; changed?: boolean }> {
    const session = this.active
    if (!session || session.conversationId !== command.conversationId || session.targetId !== command.targetId ||
        session.socket !== socket || session.actor !== actor) {
      return error('CONVERSATION_EXPIRED', 'This conversation turn is no longer active; speak to the NPC again')
    }
    const target = this.target(command.targetId, actor)
    if (target.code !== undefined) { this.invalidate(); return target }
    const state = target.state, quest = this.quests.get(state.questId)!
    if (!same(position(state.entity), session.location)) {
      this.invalidate(); return error('TARGET_CHANGED', 'Conversation target moved during the conversation')
    }
    if (quest.status !== session.status) {
      this.invalidate(); return error('QUEST_STATE_CHANGED', 'The quest changed; speak to the NPC again')
    }
    const option = state.nodes.get(session.nodeId)!.options.find(option => option.id === command.optionId)
    if (!option || !session.options.has(option.id)) return error('INVALID_OPTION', 'That response was not offered in this conversation turn')
    const condition = this.condition(option)
    if (condition.code) return error(condition.code, condition.message!)
    if (option.effect === 'close') {
      this.invalidate()
      return { changed: false, result: { kind: 'conversation', targetId: state.id, closed: true, journal: this.journal(),
        character: this.progression?.view() || { kind: 'character', supported: false } } }
    }
    const status = option.effect === 'start' ? 'active' : 'completed'
    if ((option.effect === 'start' && quest.status !== 'absent') || (option.effect === 'complete' && quest.status !== 'active')) {
      return error('QUEST_STATE_CHANGED', 'The quest no longer accepts that response')
    }
    let transaction: Transaction | undefined
    try {
      transaction = prepareOwnWrites([[quest, 'status', status], ...(this.progression?.transitionWrites(state.questId, status) || [])])
      transaction.apply()
      const result = this.issue(state, socket, actor)
      return { changed: true, result }
    } catch (failure) {
      transaction?.rollback()
      this.invalidate()
      return errorCode(failure) === 'PROGRESSION_UNAVAILABLE' ? error('PROGRESSION_UNAVAILABLE', errorMessage(failure)) :
        error('QUEST_UNAVAILABLE', 'The quest state could not be safely updated')
    }
  }

  checkpointStates() {
    const states = [...this.quests.values()].map(quest => ({ id: quest.definition.id, status: quest.status }))
      .sort((a, b) => a.id.localeCompare(b.id))
    this.validateCheckpoint(states)
    return states
  }

  validateCheckpoint(states: unknown): Transaction {
    if (!Array.isArray(states) || states.length !== this.quests.size) throw new Error('Invalid quest checkpoint')
    const seen = new Set<string>(), writes: OwnWrite[] = []
    for (const row of states) {
      const quest = this.quests.get(record(row) && typeof row.id === 'string' ? row.id : '')
      if (!exactKeys(row, ['id', 'status']) || !quest || typeof row.id !== 'string' || seen.has(row.id) || typeof row.status !== 'string' || !Object.hasOwn(STATUS_NODE, row.status) ||
          (row.status === 'completed' && !quest.completionAttainable)) throw new Error('Invalid quest checkpoint')
      seen.add(row.id)
      writes.push([quest, 'status', row.status])
    }
    return prepareOwnWrites(writes)
  }

  invalidate(socket?: object) {
    if (!socket || this.active?.socket === socket) this.active = null
  }

  clear() { this.invalidate(); this.targets.clear(); this.quests.clear() }
}
