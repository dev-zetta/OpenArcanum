import {System} from '../System';

export class RenderSystem extends System {

  test(entity) {
    // the entity must have a position component
    return !!entity.pos;
  }

  enter(entity) {
    // super useful variable (and comment)
    entity.iAmRendered = true;
  }

  update(entity) {
    //let {pos} = entity.components;

    //this.ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
  }

  exit(entity) {
    entity.iAmRendered = false;
  }
}
