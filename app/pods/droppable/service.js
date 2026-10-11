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

    // Slot-only inventories register individual dropzones after construction.
    // Current Draggable accepts an empty container list, but rejects null.
    instance = new Droppable(element ? element : [], {
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
