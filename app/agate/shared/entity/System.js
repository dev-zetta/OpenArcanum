import {ECS} from '../../libs/ecs';

export class System extends ECS.System {
  constructor(engine, ecs) {
    super();

    this.engine = engine;
    this.ecs = ecs;
  }

  get map() {
    return this.engine.map;
  }
}
