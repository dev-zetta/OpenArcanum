import {Flags} from '../../Flags';
import {MovementPath} from '../MovementPath';

export default class {
  constructor() {

    this.waypoints = [];
    this.currentWaypoint = null;
    this.movementPath = new MovementPath();

    this.flags = null;

    this._standpointDay = null;
    this._standpointNight = null;


  }


};


