import {ECS} from '../libs/ecs';
import {Entity} from './Entity';
import {Location} from './Location';

class RenderingSystem extends ECS.System {

  constructor(engine, system) {
    super();
    this.engine = engine;
  }

  test(entity) {
    // the entity must have a position component
    return !!entity.components.pos;
  }

  enter(entity) {
    // super useful variable (and comment)
    entity.iAmRendered = true;
  }

  update(entity) {
    let {pos} = entity.components;

    //this.ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
  }

  exit(entity) {
    entity.iAmRendered = false;
  }
}

class DebugSystem extends ECS.System {

  enter(entity) {
    // attach entity to window so the dev can play with it in the console
    // note: don't forget this is an example, no real world code
    window.ecsDebugEntity = entity;
  }

  exit(entity) {
    window.ecsDebugEntity = null;
  }
}

export class EntitySystem extends ECS {
  constructor(map) {
    super();

    this.map = map;
    this.addSystem(new RenderingSystem(map.engine, this));
    this.addSystem(new DebugSystem());


    this.entityMap = {};
  }

  update() {
    super.update();
  }

  async newEntity(components) {
    let baseComponent = components['Base'];
    //baseComponent.location = new Location(baseComponent.location[0], baseComponent.location[1]);
    
    let id = components.id;

    var entity = new Entity(this.map);
    await entity.loadFromData(components);

    this.entityMap[id] = entity;

    return entity;
  }

}
