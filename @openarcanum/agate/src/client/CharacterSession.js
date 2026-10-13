// Progression is an owner-private server view. Neither the renderer nor the
// interface calculates awards, level thresholds or banked Character Points.
const invalid = () => new Error('Local server supplied invalid character progression')
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function readCharacterView(value) {
  if (value?.kind !== 'character' || typeof value.supported !== 'boolean') throw invalid()
  if (!value.supported) {
    if (!exact(value, ['kind', 'supported'])) throw invalid()
    return { kind: 'character', supported: false }
  }
  if (!exact(value, ['kind', 'supported', 'experiencePoints', 'level', 'unspentPoints', 'nextLevelExperience']) ||
      !Number.isSafeInteger(value.experiencePoints) || value.experiencePoints < 0 || value.experiencePoints > 1300000 ||
      !Number.isSafeInteger(value.level) || value.level < 1 || value.level > 50 ||
      !Number.isSafeInteger(value.unspentPoints) || value.unspentPoints < 0 || value.unspentPoints > 56 ||
      (value.level === 50 ? value.nextLevelExperience !== null :
        !Number.isSafeInteger(value.nextLevelExperience) || value.nextLevelExperience <= value.experiencePoints || value.nextLevelExperience > 1300000)) {
    throw invalid()
  }
  return { kind: 'character', supported: true, experiencePoints: value.experiencePoints,
    level: value.level, unspentPoints: value.unspentPoints, nextLevelExperience: value.nextLevelExperience }
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
    if (command?.status !== 'completed' || !['load', 'reply'].includes(command.type)) return
    const signature = `${command.type}:${command.id}`
    if (signature === this.commandSignature) return
    this.commandSignature = signature
    if (snapshot.revision <= this.revision) return
    this.revision = snapshot.revision
    const ownReply = command.type === 'reply' && this.client.conversationRequest?.commandId === command.id
    if (!ownReply && this.client.characterState) {
      this.set({ status: 'stale', supported: false, revision: snapshot.revision,
        message: 'Refresh character progression to see current values.' })
    }
  }

  async refresh() {
    const c = this.client
    if (c.characterRequest) return c.characterRequest.promise
    c.assertAuthorityCommandReady({ allowPaused: true })
    const request = {}
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
}
