import Service from '@ember/service'

import Droppable from './droppable'

export default class DroppableService extends Service {
  constructor() {
    super(...arguments)

    this.instances = {}
  }

  create(id, element) {
    let instance = this.instances[id]

    if (instance) {
      if (element) {
        instance.addContainer(element)
      }

      return instance
    }

    instance = new Droppable(element, {
      /*plugins: [],
      sensors: [],
      classes: [],
      handle: null,*/
      draggable: `.draggable-source`,
      mirror: {
        constrainDimensions: true,
        appendTo: document.getElementById(`gui`)
      }
    })

    this.instances[id] = instance
    return instance
  }
}
