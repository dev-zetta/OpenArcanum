// Reviewed neutral human profile: no effects, racial/gender adjustments,
// equipment, purchased HP/fatigue points or scripted stat modifiers.
export const ATTRIBUTES = Object.freeze(([
  { id: 'strength', label: 'Strength' }, { id: 'dexterity', label: 'Dexterity' },
  { id: 'constitution', label: 'Constitution' }, { id: 'beauty', label: 'Beauty' },
  { id: 'intelligence', label: 'Intelligence' }, { id: 'perception', label: 'Perception' },
  { id: 'willpower', label: 'Willpower' }, { id: 'charisma', label: 'Charisma' },
] as const).map(attribute => Object.freeze(attribute)))
export type AttributeId = typeof ATTRIBUTES[number]['id']
export type Attributes = Record<AttributeId, number>
export const ATTRIBUTE_IDS: ReadonlyArray<AttributeId> = Object.freeze(ATTRIBUTES.map(attribute => attribute.id))
export interface DerivedNeutralStats {
  maxHealth: number
  maxFatigue: number
  carryWeight: number
  damageBonus: number
  armorClassAdjustment: number
  speed: number
  healRate: number
  poisonRecovery: number
  reactionModifier: number
  maxFollowers: number
}
const REACTION = [-65, -52, -42, -33, -25, -18, -12, -7, -3, 0, 3, 7, 12, 18, 25, 33, 42, 52, 65]
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value))
const trunc = (value: number): number => Math.trunc(value) || 0 // C integer division has no negative zero.

export function validAttributes(value: unknown): value is Attributes {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== ATTRIBUTE_IDS.length) return false
  const attributes = value as Record<string, unknown>
  return ATTRIBUTE_IDS.every(id => Object.hasOwn(attributes, id) && typeof attributes[id] === 'number' &&
    Number.isSafeInteger(attributes[id]) && attributes[id] >= 1 && attributes[id] <= 20)
}

export function copyAttributes(value: unknown): Attributes {
  if (!validAttributes(value)) throw new Error('Invalid neutral human attributes')
  return { strength: value.strength, dexterity: value.dexterity, constitution: value.constitution, beauty: value.beauty,
    intelligence: value.intelligence, perception: value.perception, willpower: value.willpower, charisma: value.charisma }
}

/** Pure previews of the reviewed original formulas and effective clamps.
 * arcanum-ce stat.c: stat_base_get (0x4B0740), stat_level_get (0x4B0490),
 * object.c: object_hp_max (0x43D5A0), critter.c: critter_fatigue_max (0x45D670).
 * These values do not install movement, combat, encumbrance or follower rules. */
export function deriveNeutralStats(attributes: Attributes, level: number): DerivedNeutralStats {
  if (!validAttributes(attributes) || !Number.isSafeInteger(level) || level < 1 || level > 50) {
    throw new Error('Invalid neutral human stat preview')
  }
  const { strength: st, dexterity: dx, constitution: cn, beauty: be, willpower: wp, charisma: ch } = attributes
  const rawDamage = st < 10 ? trunc((st - 10) / 2) : st - 10
  return {
    maxHealth: wp + 2 * (st + level) + 4,
    maxFatigue: 2 * (level + cn) + wp + 4,
    carryWeight: clamp(500 * st, 300, 10000), // Original internal stone units.
    damageBonus: clamp(rawDamage * (st >= 20 ? 2 : 1), -50, 50),
    armorClassAdjustment: clamp(dx - 10, -9, 95),
    speed: clamp(dx + (dx >= 20 ? 5 : 0), 1, 100),
    healRate: clamp(trunc((cn + 1) / 3), 0, 6),
    poisonRecovery: clamp(cn, 1, 20),
    reactionModifier: clamp(be >= 20 ? 2 * (5 * be - 50) : REACTION[be - 1]!, -65, 200),
    maxFollowers: clamp(trunc(ch / 4), 1, 7),
  }
}
