// Fixed reviewed xp_level.mes thresholds, levels 1 through 50. The level-51
// sentinel is deliberately excluded: manual page 21 says level 50, while CE's
// cap-edge control flow is not yet verified against the reference executable.
// XP saturation at 1,300,000 is an explicit development policy for this slice.
export const LEVEL_EXPERIENCE = Object.freeze([0, 2100, 4600, 7700, 11400, 15500, 20300, 25600, 31600, 38300,
  45600, 53600, 62400, 71900, 82200, 93300, 105300, 118200, 132000, 146700,
  162500, 179300, 197200, 216300, 236500, 257900, 280600, 304600, 330000, 356800,
  385100, 414900, 446300, 479500, 514300, 551000, 589500, 630000, 672500, 717100,
  764000, 813100, 864600, 918500, 975000, 1034200, 1096200, 1161100, 1229000, 1300000])
export const MAX_EXPERIENCE = LEVEL_EXPERIENCE[LEVEL_EXPERIENCE.length - 1]
// arcanum-ce stat.c stat_max_values and stat_base_set clamp the bank at 56.
export const MAX_CHARACTER_POINTS = 56
export const MAX_QUEST_EXPERIENCE = 2000000000

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const failure = () => Object.assign(new Error('Character progression could not be safely verified'), { code: 'PROGRESSION_UNAVAILABLE' })
const levelFor = experience => {
  let level = 1
  while (level < LEVEL_EXPERIENCE.length && experience >= LEVEL_EXPERIENCE[level]) level++
  return level
}
const stateKeys = ['experiencePoints', 'level', 'unspentPoints']
const validState = state => exactKeys(state, stateKeys) && Number.isSafeInteger(state.experiencePoints) &&
  state.experiencePoints >= 0 && state.experiencePoints <= MAX_EXPERIENCE && Number.isSafeInteger(state.level) &&
  state.level === levelFor(state.experiencePoints) && Number.isSafeInteger(state.unspentPoints) &&
  state.unspentPoints >= 0 && state.unspentPoints <= MAX_CHARACTER_POINTS
const same = (a, b) => stateKeys.every(key => a[key] === b[key])
const copy = state => Object.fromEntries(stateKeys.map(key => [key, state[key]]))

/** This owned actor ledger does not reinterpret or mutate legacy Critter.stats.
 * Only completed authored quests can add XP. Character Point spending and all
 * derived combat/attribute effects remain outside this slice. */
export default class CharacterProgression {
  constructor(actor, document = null) {
    this.actor = actor
    this.critter = actor.critter
    this.prototypeId = actor.base.prototype
    this.supported = this.critter?.progressionSupported === true
    if (document !== null && document !== undefined &&
        (!exactKeys(document, ['version', 'actorId', 'baseline']) || document.version !== 1 ||
          document.actorId !== '16086.json' || !validState(document.baseline))) {
      throw new Error('Authored progression rules are invalid or unsupported')
    }
    if (this.supported && (!document || actor.sourcePath !== '16086.json' || actor.base.type !== 'Pc')) {
      throw new Error('Authored actor progression requires an explicit valid baseline')
    }
    this.baseline = this.supported ? Object.freeze(copy(document.baseline)) : null
    this.state = this.supported ? copy(this.baseline) : null
    this.rewards = null
    this.questStates = null
  }

  bindQuests(quests) {
    if (this.rewards || !(quests instanceof Map) || quests.size > 64) throw failure()
    const entries = [...quests].map(([id, quest]) => [id, quest.definition.rewardExperience || 0])
    if (entries.some(([, reward]) => !Number.isSafeInteger(reward) || reward < 0 || reward > MAX_QUEST_EXPERIENCE)) throw failure()
    this.rewards = Object.freeze(Object.fromEntries(entries))
    this.questStates = () => [...quests].map(([id, quest]) => ({ id, status: quest.status }))
  }

  expected(quests) {
    if (!this.rewards || !Array.isArray(quests) || quests.length !== Object.keys(this.rewards).length) throw failure()
    const seen = new Set()
    let experience = this.baseline?.experiencePoints || 0
    for (const row of quests) {
      if (!exactKeys(row, ['id', 'status']) || !Object.hasOwn(this.rewards, row.id) || seen.has(row.id) ||
          !['absent', 'active', 'completed'].includes(row.status)) throw failure()
      seen.add(row.id)
      if (row.status === 'completed') {
        if (!this.supported && this.rewards[row.id] > 0) throw failure()
        experience += this.rewards[row.id]
      }
    }
    if (!this.supported) return null
    experience = Math.min(MAX_EXPERIENCE, experience)
    const level = levelFor(experience)
    // arcanum-ce level.c calculate_bonus_character_points (0x4A6980):
    // one per gained level, plus one when that new level is divisible by five.
    const earned = level - this.baseline.level + Math.floor(level / 5) - Math.floor(this.baseline.level / 5)
    return { experiencePoints: experience, level,
      unspentPoints: Math.min(MAX_CHARACTER_POINTS, this.baseline.unspentPoints + earned) }
  }

  validateCurrent() {
    const expected = this.expected(this.questStates?.())
    if (this.supported && (this.actor.sourcePath !== '16086.json' || this.actor.base.type !== 'Pc' ||
        this.actor.base.prototype !== this.prototypeId || this.actor.critter !== this.critter ||
        this.critter.progressionSupported !== true || !validState(this.state) || !same(this.state, expected))) throw failure()
    if (!this.supported && this.state !== null) throw failure()
    return expected
  }

  view() {
    this.validateCurrent()
    return this.supported ? { kind: 'character', supported: true, ...copy(this.state),
      nextLevelExperience: this.state.level === LEVEL_EXPERIENCE.length ? null : LEVEL_EXPERIENCE[this.state.level] } :
      { kind: 'character', supported: false }
  }

  transitionWrites(questId, status) {
    this.validateCurrent()
    const quests = this.questStates()
    const quest = quests.find(quest => quest.id === questId)
    if (!quest) throw failure()
    quest.status = status
    const expected = this.expected(quests)
    return this.supported ? stateKeys.filter(key => this.state[key] !== expected[key]).map(key => [this.state, key, expected[key]]) : []
  }

  checkpointState() {
    this.validateCurrent()
    return this.supported ? copy(this.state) : null
  }

  checkpointWrites(state, quests) {
    const expected = this.expected(quests)
    if (this.supported) {
      // This also keeps the immutable actor opt-in/component identity intact;
      // the candidate may legitimately differ from the current quest state.
      this.validateCurrent()
      if (!validState(state) || !same(state, expected)) throw failure()
      return stateKeys.map(key => [this.state, key, state[key]])
    }
    if (state !== null || expected !== null) throw failure()
    return []
  }

  clear() { this.state = null; this.rewards = null; this.questStates = null }
}
