import {Flags} from '../../Flags';

const Npc = (Base) => class extends Base {
  constructor() {
    super(...arguments);

    this._waypoints = [];

    this._flags = new Flags();

    this._standpointDay = null;
    this._standpointNight = null;
  }

  get waypoints() {
    return this._waypoints;
  }

  set waypoints(data) {
    this._waypoints = data;
  }

  get flags() {
    return this._flags;
  }


};

export { Npc };

