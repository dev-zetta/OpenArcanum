import ECS from '../libs/ecs/ecs'
import Entity from './entity'

class RenderingSystem extends ECS.System {
    // when constructing this system you must pass a canvas context
    constructor(engine, system) {
        super()
        this.engine = engine
    }
    // only entities passing this test will be added to this system
    // if omitted, all entities are added
    test(entity) {
        // the entity must have a position component
        return !!entity.components.pos
    }
    // called when an entity is added to the system
    enter(entity) {
        // super useful variable (and comment)
        entity.iAmRendered = true
    }

    update(entity) {
        let {pos} = entity.components

        //this.ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
    }
    // called when an entity is removed the system
    exit(entity) {
        entity.iAmRendered = false
    }
}

class DebugSystem extends ECS.System {
    // called when an entity is added to the system
    enter(entity) {
        // attach entity to window so the dev can play with it in the console
        // note: don't forget this is an example, no real world code
        window.ecsDebugEntity = entity
    }
    // There is not update() method. Apart from enter() and exit(), this system
    // has no overhead on the game loop

    // called when an entity is removed from the system
    exit(entity) {
        window.ecsDebugEntity = null
    }
}

export default class EntitySystem extends ECS {
    constructor(engine) {
        super()
        //this.ecs = new ECS()
        this.addSystem(new RenderingSystem(engine, this))
        this.addSystem(new DebugSystem())

        this.entityMap = {}
    }

    update() {
        super.update()
    }

    newEntity(components) {
        let baseComponent = components['Base']
        let id = components.id

        var entity = new Entity()
        entity.updateComponents(components)

        this.entityMap[id] = entity
        return entity
    }

}
