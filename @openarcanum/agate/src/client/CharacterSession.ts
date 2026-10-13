// Progression is an owner-private server view. Neither the renderer nor the
// interface calculates awards, level thresholds or banked Character Points.
import { ATTRIBUTE_IDS, type AttributeId, type DerivedNeutralStats } from '../shared/character/NeutralStats'
import { errorMessage, isInteger, isRecord, type CharacterAttribute, type CharacterRequest,
  type CharacterState, type CharacterView, type SessionActor, type SessionClient, type SessionSnapshot } from './SessionTypes'
export type { CharacterAttribute, CharacterState, CharacterView, SupportedCharacterView } from './SessionTypes'

const invalid = (): Error => new Error('Local server supplied invalid character progression')
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => isRecord(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const derivedBounds: Record<keyof DerivedNeutralStats, readonly [number, number]> = {
  maxHealth: [9, 164], maxFatigue: [9, 164], carryWeight: [500, 10000], damageBonus: [-4, 20],
  armorClassAdjustment: [-9, 10], speed: [1, 25], healRate: [0, 6], poisonRecovery: [1, 20],
  reactionModifier: [-65, 100], maxFollowers: [1, 5],
}
const displayText = (value: unknown, limit: number): value is string => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value)
const attributeId = (value: unknown): value is AttributeId => typeof value === 'string' &&
  ATTRIBUTE_IDS.some(id => id === value)

export function readCharacterView(value: unknown): CharacterView {
  if (!isRecord(value) || value.kind !== 'character' || typeof value.supported !== 'boolean') throw invalid()
  if (!value.supported) {
    if (!exact(value, ['kind', 'supported'])) throw invalid()
    return { kind: 'character', supported: false }
  }
  if (!exact(value, ['kind', 'supported', 'experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience', 'attributes', 'derived']) ||
      !isInteger(value.experiencePoints) || value.experiencePoints < 0 || value.experiencePoints > 1300000 ||
      !isInteger(value.level) || value.level < 1 || value.level > 50 ||
      !isInteger(value.unspentPoints) || value.unspentPoints < 0 || value.unspentPoints > 56 ||
      (value.level === 50 ? value.nextLevelExperience !== null :
        !isInteger(value.nextLevelExperience) || value.nextLevelExperience <= value.experiencePoints || value.nextLevelExperience > 1300000)) {
    throw invalid()
  }
  // The conditional above permits only a number below the cap, and null at it.
  const nextLevelExperience = value.nextLevelExperience
  if (nextLevelExperience !== null && !isInteger(nextLevelExperience)) throw invalid()
  if (!Array.isArray(value.attributes) || value.attributes.length !== ATTRIBUTE_IDS.length ||
      !exact(value.derived, Object.keys(derivedBounds))) throw invalid()
  const byId = new Map<AttributeId, CharacterAttribute>()
  for (const candidate of value.attributes as unknown[]) {
    const keys = ['id', 'label', 'value', 'maximum', 'pointCost', 'canIncrease', ...(isRecord(candidate) && Object.hasOwn(candidate, 'reason') ? ['reason'] : [])]
    if (!exact(candidate, keys) || !attributeId(candidate.id) || byId.has(candidate.id) || !displayText(candidate.label, 64) ||
        !isInteger(candidate.value) || candidate.value < 1 || candidate.value > 20 || candidate.maximum !== 20 || candidate.pointCost !== 1 ||
        typeof candidate.canIncrease !== 'boolean' || (candidate.reason !== undefined && !displayText(candidate.reason, 256))) throw invalid()
    byId.set(candidate.id, { id: candidate.id, label: candidate.label, value: candidate.value, maximum: 20,
      pointCost: 1, canIncrease: candidate.canIncrease, ...(Object.hasOwn(candidate, 'reason') ? { reason: candidate.reason as string | undefined } : {}) })
  }
  const derived = {} as DerivedNeutralStats
  for (const key of Object.keys(derivedBounds) as (keyof DerivedNeutralStats)[]) {
    const [min, max] = derivedBounds[key]
    const stat = value.derived[key]
    if (!isInteger(stat) || stat < min || stat > max) throw invalid()
    derived[key] = stat
  }
  return { kind: 'character', supported: true, experiencePoints: value.experiencePoints,
    level: value.level, unspentPoints: value.unspentPoints, nextLevelExperience,
    attributes: ATTRIBUTE_IDS.map(id => {
      const attribute = byId.get(id)
      if (!attribute) throw invalid()
      return attribute
    }), derived }
}

export default class CharacterSession {
  declare client: SessionClient
  revision = 0
  declare commandSignature?: string

  constructor(client: SessionClient) { this.client = client }

  set(state: CharacterState): void {
    if (this.client.stopped) return
    this.client.characterState = state
    this.client.events.emit('Player:CharacterUpdated', state)
  }

  apply(view: unknown, revision: unknown): CharacterState | null {
    const character = readCharacterView(view)
    if (!isInteger(revision) || revision < this.revision) {
      throw Object.assign(new Error('Character progression was superseded; refresh it'), { code: 'CHARACTER_SUPERSEDED' })
    }
    this.revision = revision
    this.set(character.supported ? { status: 'ready', ...character, revision, message: 'Character progression loaded.' } :
      { status: 'unavailable', ...character, revision, message: 'Character progression is unavailable for this actor.' })
    return this.client.characterState
  }

  observe(snapshot: SessionSnapshot, actor: SessionActor): void {
    const command = actor.lastCommand
    if (command?.status !== 'completed' || !['load', 'reply', 'buy-attribute'].includes(command.type || '')) return
    const signature = `${command.type}:${command.id}`
    if (signature === this.commandSignature) return
    this.commandSignature = signature
    if (snapshot.revision <= this.revision) return
    this.revision = snapshot.revision
    const ownReply = command.type === 'reply' && this.client.conversationRequest?.commandId === command.id
    const ownPurchase = command.type === 'buy-attribute' && this.client.characterRequest?.commandId === command.id
    if (!ownReply && !ownPurchase && this.client.characterState) {
      this.set({ status: 'stale', supported: false, revision: snapshot.revision,
        message: 'Refresh character progression to see current values.' })
    }
  }

  async refresh(): Promise<CharacterState | null | undefined> {
    const c = this.client
    if (c.characterRequest?.action === 'read') return c.characterRequest.promise
    c.assertAuthorityCommandReady({ allowPaused: true })
    return this.fetch()
  }

  async fetch(): Promise<CharacterState | null> {
    const c = this.client
    const request: CharacterRequest = { action: 'read' }
    c.characterRequest = request
    this.set({ status: 'pending', supported: false, message: 'Refreshing character progression…' })
    request.promise = (async () => {
      try {
        const response = await c.authority.character(c.player.id)
        if (c.stopped || !c.ready) throw new Error('Client stopped during character request')
        if (c.characterRequest !== request) throw Object.assign(new Error('Character request was superseded'), { code: 'CHARACTER_SUPERSEDED' })
        if (!isRecord(response) || response.status !== 'completed') throw invalid()
        return this.apply(response.result, response.revision)
      } catch (error: unknown) {
        if (!c.stopped && c.characterRequest === request) this.set({ status: 'rejected', supported: false, message: errorMessage(error) })
        throw error
      } finally { if (c.characterRequest === request) c.characterRequest = null }
    })()
    return request.promise
  }

  async buy(statId: string): Promise<CharacterState | null> {
    const c = this.client
    c.assertAuthorityCommandReady()
    if (c.characterState?.status !== 'ready' || c.characterState.supported !== true) {
      throw Object.assign(new Error('Refresh supported character progression before spending a point'), { code: 'PROGRESSION_UNAVAILABLE' })
    }
    const state = c.characterState
    const before = readCharacterView({ kind: state.kind, supported: state.supported, experiencePoints: state.experiencePoints,
      level: state.level, unspentPoints: state.unspentPoints, nextLevelExperience: state.nextLevelExperience,
      attributes: state.attributes, derived: state.derived })
    if (!before.supported) throw invalid()
    const selected = before.attributes.find(row => row.id === statId)
    if (!selected) throw Object.assign(new Error('Choose a supported base attribute'), { code: 'INVALID_ATTRIBUTE' })
    if (!selected.canIncrease) throw Object.assign(new Error(selected.reason || 'This attribute cannot be increased'), { code: 'ATTRIBUTE_UNAVAILABLE' })
    const request: CharacterRequest & { revision: number } = { action: 'buy-attribute', revision: c.authorityState.revision, commandId: c.authority.nextId }
    c.characterRequest = request
    c.invalidateConversation()
    c.clearContainerInspection()
    this.set({ status: 'pending', supported: false, message: `Increasing ${selected.label}…` })
    try {
      const response = await c.authority.buyAttribute(c.player.id, statId, request.revision)
      if (c.stopped || !c.ready) throw new Error('Client stopped during attribute purchase')
      if (c.characterRequest !== request) throw Object.assign(new Error('Attribute purchase was superseded'), { code: 'CHARACTER_SUPERSEDED' })
      if (!isRecord(response) || response.status !== 'completed' || !isInteger(response.revision) || response.revision <= request.revision ||
          !isRecord(response.result) || response.result.kind !== 'buy-attribute' || response.result.statId !== statId) throw invalid()
      const after = readCharacterView(response.result.character)
      if (!after.supported || after.experiencePoints !== before.experiencePoints || after.level !== before.level ||
          after.nextLevelExperience !== before.nextLevelExperience || after.unspentPoints !== before.unspentPoints - selected.pointCost ||
          before.attributes.some(row => {
            const changed = after.attributes.find(value => value.id === row.id)
            return !changed || changed.label !== row.label || changed.maximum !== row.maximum || changed.pointCost !== row.pointCost ||
              changed.value !== row.value + (row.id === statId ? 1 : 0)
          })) throw new Error('Local server supplied inconsistent attribute purchase balances')
      this.apply(after, response.revision)
      if (c.characterState) this.set({ ...c.characterState, message: `${selected.label} increased.` })
      return c.characterState
    } catch (error: unknown) {
      if (!c.stopped && c.characterRequest === request) {
        // An acknowledgement can be lost after the commit. Read once and
        // preserve that private result; never submit the purchase again.
        try {
          await this.fetch()
          if (c.characterState) this.set({ ...c.characterState, message: `${errorMessage(error)} Current character progression reloaded.` })
        } catch (_) { /* fetch already publishes a safe rejected view */ }
      }
      throw error
    } finally { if (c.characterRequest === request) c.characterRequest = null }
  }
}
