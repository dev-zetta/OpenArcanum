/* global AGate */
import Core from './Core'
import  Flags  from '../../Flags'
import  AiState  from '../ai/AiState'

export default class Npc extends Core {
  /**
   *
   */
  constructor() {
    super(...arguments)
    this.waypoints = []
    this.currentWaypoint = null
    this.aiState = new AiState()

    this.flags = null

    //this._standpointDay = null;
    //this._standpointNight = null;
  }

  getViewRange() {
    return 30
  }

  getMovementSpeed() {
    return 1.0
  }

  getAttackSpeed() {
    return 1.0
  }

  getMeeleDistance() {
    return 1
  }

  hasMeeleWeapon() {
    return true
  }

  hasRangedWeapon() {
    return false
  }

  hasWeaponEquipped() {
    return false
  }

  equipWeapon() {}
}
