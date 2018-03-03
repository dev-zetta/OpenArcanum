/* global AGate */

import {Flags} from '../../Flags';
import {AiState} from '../ai/AiState';

export default class {
  constructor() {

    this.waypoints = [];
    this.currentWaypoint = null;
    this.aiState = new AiState();

    this.flags = null;

    //this._standpointDay = null;
    //this._standpointNight = null;


  }

  getViewRange() {
    return 30;
  }

  getMovementSpeed() {
    return 1.0;
  }

  getAttackSpeed() {
    return 1.0;
  }

  getMeeleDistance() {
    return 1;
  }

  hasMeeleeWeapon() {
    return true;
  }

  hasRangedWeapon() {
    return false;
  }

  hasWeaponEquipped() {
    return false;
  }

  equipWeapon() {

  }

};


