import type { LocationRaw } from '../Types'
export type Stats = { strength: number; dexterity: number; constitution: number; beauty: number; intelligence: number; perception: number; willpower: number; charisma: number; carryWeight: number; damageBonus: number; armorClassAdjustment: number; speed: number; healRate: number; poisonRecovery: number; reactionModifier: number; maxFollowers: number; magicTechAptitude: number; level: number; experiencePoints: number; alignment: number; fatePoints: number; unspentPoints: number; magicPoints: number; techPoints: number; poisonLevel: number; age: number }
export type Fatigue = { points: number; adjustment: number; damage: number }
import Component from './Component'

import MovementPath from '../MovementPath'
import AiState from '../ai/State'

export default class Critter extends Component {
  declare stats: Stats
  declare fatigue: Fatigue
  declare gender: string
  declare race: string
  declare armor: string
  declare shield: string
  declare weapon: string
  declare animation: string
  declare hitChart: number
  declare inventoryIndex: number
  declare inventorySource: string
  declare inventory: Array<{ id: string; slot: number }>
  declare descUnknown: number
  declare teleportDest: LocationRaw
  declare teleportMap: string
  declare deathTime: Date
  declare levelScheme: string
  declare portrait: string
  declare movementPath: MovementPath
  declare aiState: AiState


                                                 // Recovered instance ownership, not inferred from coordinates.

  constructor() {
    super()

    this.movementPath = new MovementPath()
    this.aiState = new AiState()
  }

  init(params: { entity: import("../Entity").default }) {
    super.init(params)

    this.movementPath.clear()
    this.aiState.clear()
  }

  getViewRange(): number {
    return 5
  }

  getMovementSpeed(): number {
    if (this.aiState.hasAny([AiState.Flags.Running])) {
      return 2.0
    }

    return 1.0
  }

  getAttackSpeed(): number {
    return 1.0
  }

  getMeleeDistance(): number {
    return 1.0
  }

  hasMeleeWeapon(): boolean {
    return true
  }

  hasRangedWeapon(): boolean {
    return false
  }

  hasWeaponEquipped(): boolean {
    return false
  }

  equipWeapon(): boolean {
    return true
  }

  maxHealth() {
    let { base } = this.entity

    let health = base.health.points + base.health.adjustment

    health += this.stats.strength * 2
    health += this.stats.willpower
    return health
  }

  currentHealth() {
    let { base } = this.entity
    return this.maxHealth() - base.health.damage
  } }
