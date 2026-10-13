import { ATTRIBUTES, ATTRIBUTE_IDS, validAttributes, copyAttributes, deriveNeutralStats } from '../../shared/character/NeutralStats'

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
const failure = (code = 'PROGRESSION_UNAVAILABLE', message = 'Character progression could not be safely verified') =>
  Object.assign(new Error(message), { code })
const levelFor = experience => {
  let level = 1
  while (level < LEVEL_EXPERIENCE.length && experience >= LEVEL_EXPERIENCE[level]) level++
  return level
}
const numericKeys = ['experiencePoints', 'level', 'unspentPoints']
const baselineKeys = [...numericKeys, 'attributes']
const stateKeys = [...baselineKeys, 'history']
const validCounters = state => Number.isSafeInteger(state.experiencePoints) && state.experiencePoints >= 0 &&
  state.experiencePoints <= MAX_EXPERIENCE && Number.isSafeInteger(state.level) && state.level === levelFor(state.experiencePoints) &&
  Number.isSafeInteger(state.unspentPoints) && state.unspentPoints >= 0 && state.unspentPoints <= MAX_CHARACTER_POINTS
const validBaseline = state => exactKeys(state, baselineKeys) && validCounters(state) && validAttributes(state.attributes)
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equalField = (left, right) => typeof left === 'object' ? JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)) : left === right
const same = (left, right) => stateKeys.every(key => equalField(left[key], right[key]))
const copyHistory = history => history.map(event => ({ ...event }))
const copy = state => ({ ...Object.fromEntries(numericKeys.map(key => [key, state[key]])),
  attributes: copyAttributes(state.attributes), history: copyHistory(state.history) })
const freezeState = state => ({ ...state, attributes: Object.freeze(copyAttributes(state.attributes)),
  history: Object.freeze(copyHistory(state.history).map(event => Object.freeze(event))) })
export const MAX_PROGRESSION_EVENTS = 256

/** This explicitly authored neutral actor ledger does not read or mutate legacy
 * Critter.stats. Ordered events reproduce bank overflow at its actual moment,
 * rather than treating awards and purchases as commutative totals. */
export default class CharacterProgression {
  constructor(actor, document = null) {
    this.actor = actor
    this.critter = actor.critter
    this.prototypeId = actor.base.prototype
    this.supported = this.critter?.progressionSupported === true
    if (document !== null && document !== undefined &&
        (!exactKeys(document, ['version', 'actorId', 'profile', 'baseline']) || document.version !== 2 ||
          document.actorId !== '16086.json' || document.profile !== 'neutral-human' || !validBaseline(document.baseline))) {
      throw new Error('Authored progression rules are invalid or unsupported')
    }
    if (this.supported && (!document || actor.sourcePath !== '16086.json' || actor.base.type !== 'Pc')) {
      throw new Error('Authored actor progression requires an explicit valid baseline')
    }
    this.baseline = this.supported ? Object.freeze({ ...document.baseline,
      attributes: Object.freeze(copyAttributes(document.baseline.attributes)) }) : null
    this.state = this.supported ? freezeState({ ...this.baseline, history: [] }) : null
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

  expected(quests, history = this.state?.history) {
    if (!this.rewards || !Array.isArray(quests) || quests.length !== Object.keys(this.rewards).length) throw failure()
    const seen = new Set(), completed = new Set()
    for (const row of quests) {
      if (!exactKeys(row, ['id', 'status']) || !Object.hasOwn(this.rewards, row.id) || seen.has(row.id) ||
          !['absent', 'active', 'completed'].includes(row.status)) throw failure()
      seen.add(row.id)
      if (row.status === 'completed') completed.add(row.id)
    }
    if (!this.supported) {
      if ([...completed].some(id => this.rewards[id] > 0)) throw failure()
      return null
    }
    if (!Array.isArray(history) || history.length > MAX_PROGRESSION_EVENTS) throw failure()
    const rewarded = new Set(), attributes = copyAttributes(this.baseline.attributes)
    let experience = this.baseline.experiencePoints, level = this.baseline.level, bank = this.baseline.unspentPoints
    for (const event of history) {
      if (event?.kind === 'quest') {
        if (!exactKeys(event, ['kind', 'questId']) || !Object.hasOwn(this.rewards, event.questId) ||
            !completed.has(event.questId) || rewarded.has(event.questId)) throw failure()
        experience = Math.min(MAX_EXPERIENCE, experience + this.rewards[event.questId])
        const nextLevel = levelFor(experience)
        // CE level.c 0x4A6980 grants one per gained level and one per fifth
        // level. Clamp the bank now, BEFORE later purchase events spend it.
        bank = Math.min(MAX_CHARACTER_POINTS, bank + nextLevel - level + Math.floor(nextLevel / 5) - Math.floor(level / 5))
        level = nextLevel
        rewarded.add(event.questId)
      } else if (event?.kind === 'attribute') {
        if (!exactKeys(event, ['kind', 'statId']) || !ATTRIBUTE_IDS.includes(event.statId) ||
            attributes[event.statId] >= 20 || bank < 1) throw failure()
        attributes[event.statId]++
        bank--
      } else throw failure()
    }
    if (rewarded.size !== completed.size) throw failure()
    return freezeState({ experiencePoints: experience, level, unspentPoints: bank, attributes, history })
  }

  validateCurrent() {
    const expected = this.expected(this.questStates?.(), this.state?.history)
    if (this.supported && (this.actor.sourcePath !== '16086.json' || this.actor.base.type !== 'Pc' ||
        this.actor.base.prototype !== this.prototypeId || this.actor.critter !== this.critter ||
        this.critter.progressionSupported !== true || !exactKeys(this.state, stateKeys) ||
        !validCounters(this.state) || !validAttributes(this.state.attributes) || !same(this.state, expected))) throw failure()
    if (!this.supported && this.state !== null) throw failure()
    return expected
  }

  view() {
    this.validateCurrent()
    if (!this.supported) return { kind: 'character', supported: false }
    const state = this.state
    return { kind: 'character', supported: true, ...Object.fromEntries(numericKeys.map(key => [key, state[key]])),
      nextLevelExperience: state.level === LEVEL_EXPERIENCE.length ? null : LEVEL_EXPERIENCE[state.level],
      attributes: ATTRIBUTES.map(({ id, label }) => {
        const maximum = state.attributes[id] >= 20, affordable = state.unspentPoints >= 1
        return { id, label, value: state.attributes[id], maximum: 20, pointCost: 1, canIncrease: !maximum && affordable,
          ...(maximum ? { reason: 'Attribute is at its maximum.' } : !affordable ? { reason: 'Not enough Character Points.' } : {}) }
      }), derived: deriveNeutralStats(state.attributes, state.level) }
  }

  writes(expected) {
    return stateKeys.filter(key => !equalField(this.state[key], expected[key])).map(key => [this.state, key, expected[key]])
  }

  transitionWrites(questId, status) {
    this.validateCurrent()
    const quests = this.questStates(), quest = quests.find(quest => quest.id === questId)
    if (!quest || (status === 'completed' ? quest.status !== 'active' : status !== 'active' || quest.status !== 'absent')) throw failure()
    quest.status = status
    const history = this.supported ? copyHistory(this.state.history) : null
    if (this.supported && status === 'completed') history.push({ kind: 'quest', questId })
    const expected = this.expected(quests, history)
    return this.supported ? this.writes(expected) : []
  }

  purchaseWrites(statId) {
    this.validateCurrent()
    if (!this.supported) throw failure()
    if (!ATTRIBUTE_IDS.includes(statId)) throw failure('INVALID_COMMAND', 'Choose a supported base attribute')
    if (this.state.attributes[statId] >= 20) throw failure('ATTRIBUTE_AT_MAX', 'Attribute is at its maximum.')
    if (this.state.unspentPoints < 1) throw failure('INSUFFICIENT_POINTS', 'Not enough Character Points.')
    const history = [...copyHistory(this.state.history), { kind: 'attribute', statId }]
    return this.writes(this.expected(this.questStates(), history))
  }

  checkpointState() {
    this.validateCurrent()
    return this.supported ? copy(this.state) : null
  }

  checkpointWrites(state, quests) {
    const expected = this.expected(quests, state?.history)
    if (this.supported) {
      this.validateCurrent()
      if (!exactKeys(state, stateKeys) || !validCounters(state) || !validAttributes(state.attributes) || !same(state, expected)) throw failure()
      return stateKeys.map(key => [this.state, key, expected[key]])
    }
    if (state !== null || expected !== null) throw failure()
    return []
  }

  clear() { this.state = null; this.rewards = null; this.questStates = null }
}
