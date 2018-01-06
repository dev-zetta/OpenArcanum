import ECS from '../libs/ecs/ecs'

const Location = {
    name: 'location',
    defaults: {x: 0, y: 0}
}

class Entity extends ECS.Entity {
    constructor() {
        super([Location])

        /*let entity = new ECS.Entity();
        entity.updateComponent('pos', {
            x: canvas.width / 2,
            y: canvas.height / 2
        });
*/
    }
}

export default Entity
