import {Location} from '../../Location';
import {Math} from '../../Math';

const Base = (Base) => class extends Base {
  constructor() {
    super(...arguments);

    this.location = new Location();
    this.offset = new Math.Vec2();
  }


};

export { Base };

