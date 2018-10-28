import { ECS } from '../../libs/ecs'

export class System extends ECS.System {
  constructor(engine, ecs) {
    super()

    this.engine = engine
    this.ecs = ecs
    this.totalElapsed = 0
  }

  get map() {
    return this.engine.map
  }

  update(entity, elapsed) {
    this.totalElapsed += elapsed
  }
}
