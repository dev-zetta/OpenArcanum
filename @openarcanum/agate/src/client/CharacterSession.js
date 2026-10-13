// Progression is an owner-private server view. Neither the renderer nor the
// interface calculates awards, level thresholds or banked Character Points.
const invalid = () => new Error('Local server supplied invalid character progression')
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const attributeIds = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence', 'perception', 'willpower', 'charisma']
const derivedBounds = { maxHealth: [9, 164], maxFatigue: [9, 164], carryWeight: [500, 10000],
  damageBonus: [-4, 20], armorClassAdjustment: [-9, 10], speed: [1, 25], healRate: [0, 6],
  poisonRecovery: [1, 20], reactionModifier: [-65, 100], maxFollowers: [1, 5] }
const displayText = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value)

export function readCharacterView(value) {
  if (value?.kind !== 'character' || typeof value.supported !== 'boolean') throw invalid()
  if (!value.supported) {
    if (!exact(value, ['kind', 'supported'])) throw invalid()
    return { kind: 'character', supported: false }
  }
  if (!exact(value, ['kind', 'supported', 'experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience', 'attributes', 'derived']) ||
      !Number.isSafeInteger(value.experiencePoints) || value.experiencePoints < 0 || value.experiencePoints > 1300000 ||
      !Number.isSafeInteger(value.level) || value.level < 1 || value.level > 50 ||
      !Number.isSafeInteger(value.unspentPoints) || value.unspentPoints < 0 || value.unspentPoints > 56 ||
      (value.level === 50 ? value.nextLevelExperience !== null :
        !Number.isSafeInteger(value.nextLevelExperience) || value.nextLevelExperience <= value.experiencePoints || value.nextLevelExperience > 1300000)) {
    throw invalid()
  }
  if (!Array.isArray(value.attributes) || value.attributes.length !== attributeIds.length ||
      !exact(value.derived, Object.keys(derivedBounds))) throw invalid()
  const byId = new Map()
  for (const row of value.attributes) {
    const keys = ['id', 'label', 'value', 'maximum', 'pointCost', 'canIncrease', ...(Object.hasOwn(row || {}, 'reason') ? ['reason'] : [])]
    if (!exact(row, keys) || !attributeIds.includes(row.id) || byId.has(row.id) || !displayText(row.label, 64) ||
        !Number.isSafeInteger(row.value) || row.value < 1 || row.value > 20 || row.maximum !== 20 || row.pointCost !== 1 ||
        typeof row.canIncrease !== 'boolean' || (row.reason !== undefined && !displayText(row.reason, 256))) throw invalid()
    byId.set(row.id, { ...row })
  }
  const derived = {}
  for (const [key, [min, max]] of Object.entries(derivedBounds)) {
    if (!Number.isSafeInteger(value.derived[key]) || value.derived[key] < min || value.derived[key] > max) throw invalid()
    derived[key] = value.derived[key]
  }
  return { kind: 'character', supported: true, experiencePoints: value.experiencePoints,
    level: value.level, unspentPoints: value.unspentPoints, nextLevelExperience: value.nextLevelExperience,
    attributes: attributeIds.map(id => byId.get(id)), derived }
}

export default class CharacterSession {
  constructor(client) { this.client = client; this.revision = 0 }

  set(state) {
    if (this.client.stopped) return
    this.client.characterState = state
    this.client.events.emit('Player:CharacterUpdated', state)
  }

  apply(view, revision) {
    const character = readCharacterView(view)
    if (!Number.isSafeInteger(revision) || revision < this.revision) {
      throw Object.assign(new Error('Character progression was superseded; refresh it'), { code: 'CHARACTER_SUPERSEDED' })
    }
    this.revision = revision
    this.set({ status: character.supported ? 'ready' : 'unavailable', ...character, revision,
      message: character.supported ? 'Character progression loaded.' : 'Character progression is unavailable for this actor.' })
    return this.client.characterState
  }

  observe(snapshot, actor) {
    const command = actor.lastCommand
    if (command?.status !== 'completed' || !['load', 'reply', 'buy-attribute'].includes(command.type)) return
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

  async refresh() {
    const c = this.client
    if (c.characterRequest?.action === 'read') return c.characterRequest.promise
    c.assertAuthorityCommandReady({ allowPaused: true })
    return this.fetch()
  }

  async fetch() {
    const c = this.client
    const request = { action: 'read' }
    c.characterRequest = request
    this.set({ status: 'pending', supported: false, message: 'Refreshing character progression…' })
    request.promise = (async () => {
      try {
        const response = await c.authority.character(c.player.id)
        if (c.stopped || !c.ready) throw new Error('Client stopped during character request')
        if (c.characterRequest !== request) throw Object.assign(new Error('Character request was superseded'), { code: 'CHARACTER_SUPERSEDED' })
        if (response?.status !== 'completed') throw invalid()
        return this.apply(response.result, response.revision)
      } catch (error) {
        if (!c.stopped && c.characterRequest === request) this.set({ status: 'rejected', supported: false, message: error.message })
        throw error
      } finally { if (c.characterRequest === request) c.characterRequest = null }
    })()
    return request.promise
  }

  async buy(statId) {
    const c = this.client
    c.assertAuthorityCommandReady()
    if (c.characterState?.status !== 'ready' || c.characterState.supported !== true) {
      throw Object.assign(new Error('Refresh supported character progression before spending a point'), { code: 'PROGRESSION_UNAVAILABLE' })
    }
    const before = readCharacterView(Object.fromEntries(['kind', 'supported', 'experiencePoints', 'level', 'unspentPoints',
      'nextLevelExperience', 'attributes', 'derived'].map(key => [key, c.characterState[key]])))
    const selected = before.attributes.find(row => row.id === statId)
    if (!selected) throw Object.assign(new Error('Choose a supported base attribute'), { code: 'INVALID_ATTRIBUTE' })
    if (!selected.canIncrease) throw Object.assign(new Error(selected.reason || 'This attribute cannot be increased'), { code: 'ATTRIBUTE_UNAVAILABLE' })
    const request = { action: 'buy-attribute', revision: c.authorityState.revision, commandId: c.authority.nextId }
    c.characterRequest = request
    c.invalidateConversation()
    c.clearContainerInspection()
    this.set({ status: 'pending', supported: false, message: `Increasing ${selected.label}…` })
    try {
      const response = await c.authority.buyAttribute(c.player.id, statId, request.revision)
      if (c.stopped || !c.ready) throw new Error('Client stopped during attribute purchase')
      if (c.characterRequest !== request) throw Object.assign(new Error('Attribute purchase was superseded'), { code: 'CHARACTER_SUPERSEDED' })
      if (response?.status !== 'completed' || !Number.isSafeInteger(response.revision) || response.revision <= request.revision ||
          response.result?.kind !== 'buy-attribute' || response.result.statId !== statId) throw invalid()
      const after = readCharacterView(response.result.character)
      if (!after.supported || after.experiencePoints !== before.experiencePoints || after.level !== before.level ||
          after.nextLevelExperience !== before.nextLevelExperience || after.unspentPoints !== before.unspentPoints - selected.pointCost ||
          before.attributes.some(row => {
            const changed = after.attributes.find(value => value.id === row.id)
            return changed.label !== row.label || changed.maximum !== row.maximum || changed.pointCost !== row.pointCost ||
              changed.value !== row.value + (row.id === statId ? 1 : 0)
          })) throw new Error('Local server supplied inconsistent attribute purchase balances')
      this.apply(after, response.revision)
      this.set({ ...c.characterState, message: `${selected.label} increased.` })
      return c.characterState
    } catch (error) {
      if (!c.stopped && c.characterRequest === request) {
        // An acknowledgement can be lost after the commit. Read once and
        // preserve that private result; never submit the purchase again.
        try {
          await this.fetch()
          this.set({ ...c.characterState, message: `${error.message} Current character progression reloaded.` })
        } catch (_) { /* fetch already publishes a safe rejected view */ }
      }
      throw error
    } finally { if (c.characterRequest === request) c.characterRequest = null }
  }
}
