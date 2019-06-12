//@flow
import Component from './Component'
import type {LocationRaw} from '../Types'
import MovementPath from '../MovementPath';
import AiState from '../ai/State'

export type Stats = {
  strength: number,
  dexterity: number,
  constitution: number,
  beauty: number,
  intelligence: number,
  perception: number,
  willpower: number,
  charisma: number,
  carryWeight: number,
  damageBonus: number,
  armorClassAdjustment: number,
  speed: number,
  healRate: number,
  poisonRecovery: number,
  reactionModifier: number,
  maxFollowers: number,
  magicTechAptitude: number,
  level: number,
  experiencePoints: number,
  alignment: number,
  fatePoints: number,
  unspentPoints: number,
  magicPoints: number,
  techPoints: number,
  poisonLevel: number,
  age: number
}

export type Fatigue = {
  points: number,
  adjustment: number,
  damage: number
}

export default class Critter extends Component {
  stats: Stats
  fatigue: Fatigue

  gender: string
  race: string
  armor: string
  shield: string
  weapon: string
  animation: string

  hitChart: number
  inventoryIndex: number
  inventorySource: string
  descUnknown: number
  teleportDest: LocationRaw
  teleportMap: string
  deathTime: Date
  levelScheme: string
  portrait: string

  movementPath: MovementPath
  aiState: AiState

  constructor() {
    super(...arguments)

    this.movementPath = new MovementPath()
    this.aiState = new AiState()

  }



  getViewRange(): number {
    return 30
  }

  getMovementSpeed(): number {
    return 1.0
  }

  getAttackSpeed(): number {
    return 1.0
  }

  getMeleeDistance(): number {
    return 1
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

  equipWeapon(): boolean {}
}
