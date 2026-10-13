// Private dialogue pages are capabilities, not client-authored quest state.
// This adapter never retries a reply after an uncertain acknowledgement.
import { readCharacterView } from './CharacterSession'
import { errorMessage, isInteger, isRecord, type CharacterView, type ConversationOption, type ConversationRequest,
  type ConversationState, type ConversationTarget, type JournalRequest, type JournalState, type QuestEntry,
  type SessionActor, type SessionClient, type SessionSnapshot } from './SessionTypes'
export type { ConversationOption, ConversationState, ConversationTarget, JournalState, QuestEntry } from './SessionTypes'

const failure = (message: string, code?: string): Error & { code?: string } => Object.assign(new Error(message), code ? { code } : {})
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length > 0 &&
  value.length <= limit && !/[\x00-\x08\x0b-\x1f\x7f]/.test(value)
const id = (value: unknown): value is string => text(value, 128) && !/\s/.test(value)

function journalEntries(rows: unknown): QuestEntry[] {
  const ids = new Set<string>()
  if (!Array.isArray(rows) || rows.length > 64) throw failure('Local server supplied an invalid quest journal')
  return (rows as unknown[]).map(row => {
    if (!isRecord(row) || !id(row.id) || ids.has(row.id) || !text(row.title, 128) ||
        (row.status !== 'active' && row.status !== 'completed') || !text(row.text, 2048)) {
      throw failure('Local server supplied an invalid quest journal')
    }
    ids.add(row.id)
    return { id: row.id, title: row.title, status: row.status, text: row.text }
  })
}

type ConversationPage = { entries: QuestEntry[]; character: CharacterView } &
  ({ closed: true } | { closed: false; conversationId: string; nodeId: string; speaker: string;
    text: string; options: ConversationOption[] })

function page(response: unknown, targetId: string): { revision: number; view: ConversationPage } {
  if (!isRecord(response) || response.status !== 'completed' || !isInteger(response.revision) || response.revision < 0 ||
      !isRecord(response.result) || response.result.kind !== 'conversation' || response.result.targetId !== targetId ||
      typeof response.result.closed !== 'boolean') {
    throw failure('Local server supplied an invalid conversation')
  }
  const result = response.result
  const entries = journalEntries(isRecord(result.journal) ? result.journal.entries : undefined)
  const character = readCharacterView(result.character)
  if (result.closed) return { revision: response.revision, view: { closed: true, entries, character } }
  const ids = new Set<string>()
  if (!id(result.conversationId) || !id(result.nodeId) || !text(result.speaker, 128) || !text(result.text, 2048) ||
      !Array.isArray(result.options) || result.options.length < 1 || result.options.length > 5) {
    throw failure('Local server supplied an invalid conversation')
  }
  const options = (result.options as unknown[]).map(option => {
    if (!isRecord(option) || !id(option.id) || ids.has(option.id) || !text(option.text, 512)) throw failure('Local server supplied invalid conversation replies')
    ids.add(option.id)
    return { id: option.id, text: option.text }
  })
  return { revision: response.revision, view: { closed: false, entries, character, conversationId: result.conversationId,
    nodeId: result.nodeId, speaker: result.speaker, text: result.text, options } }
}

export default class ConversationSession {
  declare client: SessionClient
  epoch = 0
  questRevision = 0
  declare targetSignature?: string
  declare questCommandSignature?: string

  constructor(client: SessionClient) { this.client = client }

  setConversation(state: ConversationState): void {
    if (this.client.stopped) return
    this.client.conversationState = state
    this.client.events.emit('Player:ConversationUpdated', state)
  }

  setJournal(state: JournalState): void {
    if (this.client.stopped) return
    this.client.journalState = state
    this.client.events.emit('Player:JournalUpdated', state)
  }

  invalidate(message = 'Conversation ended. Talk again to see current replies.'): void {
    this.epoch++
    if (this.client.conversationState && !['closed', 'stale'].includes(this.client.conversationState.status)) {
      const { targetId, speaker } = this.client.conversationState
      this.setConversation({ status: 'stale', targetId, speaker, message, options: [] })
    }
  }

  close(): void {
    if (this.client.conversationRequest) throw failure('A conversation action is already in progress', 'BUSY')
    this.epoch++
    this.setConversation({ status: 'closed', message: 'Conversation closed.', options: [] })
  }

  targets(snapshot: SessionSnapshot): ConversationTarget[] {
    const rows = snapshot.conversationTargets || [], ids = new Set<string>()
    if (!Array.isArray(rows) || rows.length > 64) throw failure('Local server supplied invalid conversation targets')
    const targets: ConversationTarget[] = (rows as unknown[]).map(row => {
      if (!isRecord(row) || !text(row.id, 1024) || ids.has(row.id) || row.kind !== 'conversation' || !text(row.label, 128) ||
          !Array.isArray(row.location) || row.location.length !== 2 || !isInteger(row.location[0]) || !isInteger(row.location[1])) {
        throw failure('Local server supplied invalid conversation targets')
      }
      ids.add(row.id)
      return { id: row.id, kind: 'conversation', label: row.label, location: [row.location[0], row.location[1]] }
    })
    const signature = JSON.stringify(targets)
    if (signature !== this.targetSignature) {
      this.targetSignature = signature
      this.client.events.emit('World:ConversationTargetsUpdated', targets)
    }
    return targets
  }

  observe(snapshot: SessionSnapshot, actor: SessionActor): void {
    this.targets(snapshot)
    const c = this.client, request = c.conversationRequest
    const ownReply = request?.action === 'reply' && request.commandId === actor.lastCommand?.id && actor.lastCommand?.type === 'reply'
    // A talk first uses ordinary authoritative movement. That approach's
    // revisions belong to the pending request rather than to an open page.
    if (request?.phase !== 'approach' && !ownReply &&
        snapshot.revision > (request?.revision ?? c.conversationState?.revision ?? Infinity)) this.invalidate()
    const command = actor.lastCommand
    if (command?.status === 'completed' && ['load', 'reply'].includes(command.type || '')) {
      const signature = `${command.type}:${command.id}`
      if (signature !== this.questCommandSignature) {
        this.questCommandSignature = signature
        this.questRevision = snapshot.revision
        if (!ownReply && c.journalState) this.setJournal({ status: 'stale', message: 'Refresh the journal to see current quest state.', entries: [] })
      }
    }
  }

  active(request: ConversationRequest): void {
    if (this.client.stopped || !this.client.ready) throw failure('Client stopped during conversation')
    if (request.epoch !== this.epoch) throw failure('Conversation was superseded; talk again', 'CONVERSATION_SUPERSEDED')
  }

  async begin(targetId: string): Promise<ConversationState | null> {
    const c = this.client
    c.assertAuthorityCommandReady()
    if (!c.authorityState?.conversationTargets?.some(target => target.id === targetId)) throw failure('This object has no supported conversation', 'UNKNOWN_TARGET')
    this.invalidate()
    const request: ConversationRequest = { action: 'talk', phase: 'approach', epoch: this.epoch }
    c.conversationRequest = request
    c.clearContainerInspection()
    this.setConversation({ status: 'pending', targetId, message: 'Approaching speaker…', options: [] })
    try {
      await c.useTarget(targetId, { conversationAction: true })
      this.active(request)
      const revision = c.authorityState.revision
      request.phase = 'command'; request.revision = revision
      request.commandId = c.authority.nextId
      const response = await c.authority.talk(c.player.id, targetId)
      this.active(request)
      return this.accept(response, targetId, revision)
    } catch (error: unknown) {
      if (!c.stopped && request.epoch === this.epoch) this.setConversation({ status: 'rejected', targetId, message: errorMessage(error), options: [] })
      throw error
    } finally { if (c.conversationRequest === request) c.conversationRequest = null }
  }

  accept(response: unknown, targetId: string, minimumRevision: number): ConversationState | null {
    const c = this.client, { view, revision } = page(response, targetId)
    if (revision < minimumRevision || revision < (c.authorityState?.revision ?? 0)) {
      throw failure('Conversation was superseded; talk again', 'CONVERSATION_SUPERSEDED')
    }
    this.questRevision = Math.max(this.questRevision, revision)
    c.getCharacterSession().apply(view.character, revision)
    this.setJournal({ status: 'ready', entries: view.entries, revision,
      message: view.entries.length ? 'Journal loaded.' : 'No quests recorded.' })
    this.setConversation(view.closed ? { status: 'closed', targetId, message: 'Conversation closed.', options: [] } : {
      status: 'ready', targetId, revision, conversationId: view.conversationId,
      nodeId: view.nodeId, speaker: view.speaker, text: view.text, options: view.options, message: 'Choose a reply.'
    })
    return c.conversationState
  }

  async reply(optionId: string): Promise<ConversationState | null> {
    const c = this.client
    c.assertAuthorityCommandReady()
    const state = c.conversationState
    if (state?.status !== 'ready' || state.revision !== c.authorityState.revision || !state.options.some(option => option.id === optionId)) {
      throw failure('Choose a current reply after talking to the speaker', 'STALE_CONVERSATION')
    }
    const request: ConversationRequest = { action: 'reply', phase: 'command', epoch: this.epoch, revision: state.revision, commandId: c.authority.nextId }
    c.conversationRequest = request
    this.setConversation({ status: 'pending', targetId: state.targetId, speaker: state.speaker, message: 'Sending reply…', options: [] })
    try {
      const response = await c.authority.reply(c.player.id, state.targetId, state.conversationId, optionId, state.revision)
      this.active(request)
      return this.accept(response, state.targetId, state.revision)
    } catch (error: unknown) {
      if (!c.stopped && request.epoch === this.epoch) {
        this.invalidate()
        this.setConversation({ status: 'rejected', targetId: state.targetId, message: `${errorMessage(error)} Talk again before replying.`, options: [] })
        // The reply may have committed. Read the resulting journal once;
        // resending the choice would risk replaying its future side effects.
        await this.fetchJournal().catch(() => {})
      }
      throw error
    } finally { if (c.conversationRequest === request) c.conversationRequest = null }
  }

  async refreshJournal(): Promise<JournalState | null | undefined> {
    const c = this.client
    if (c.journalRequest) return c.journalRequest.promise
    c.assertAuthorityCommandReady({ allowPaused: true })
    return this.fetchJournal()
  }

  async fetchJournal(): Promise<JournalState | null> {
    const c = this.client, request: JournalRequest = { revision: this.questRevision }
    c.journalRequest = request
    this.setJournal({ status: 'pending', message: 'Refreshing journal…', entries: [] })
    request.promise = (async () => {
      try {
        const response = await c.authority.journal(c.player.id)
        if (c.stopped || !c.ready) throw failure('Client stopped during journal request')
        if (c.journalRequest !== request || (isRecord(response) && isInteger(response.revision) && response.revision < this.questRevision)) {
          throw failure('Journal request was superseded', 'JOURNAL_SUPERSEDED')
        }
        if (!isRecord(response) || response.status !== 'completed' || !isInteger(response.revision) || response.revision < 0 ||
            !isRecord(response.result) || response.result.kind !== 'journal') {
          throw failure('Local server supplied an invalid quest journal')
        }
        const entries = journalEntries(response.result.entries)
        const character = readCharacterView(response.result.character)
        c.getCharacterSession().apply(character, response.revision)
        this.setJournal({ status: 'ready', entries, revision: response.revision,
          message: entries.length ? 'Journal loaded.' : 'No quests recorded.' })
        return c.journalState
      } catch (error: unknown) {
        if (!c.stopped && c.journalRequest === request) this.setJournal({ status: 'rejected', message: errorMessage(error), entries: [] })
        throw error
      } finally { if (c.journalRequest === request) c.journalRequest = null }
    })()
    return request.promise
  }
}
