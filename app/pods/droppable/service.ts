import Service from '@ember/service'
import Droppable from './droppable'

export default class DroppableService extends Service {
  instances: Record<string, Droppable> = {}
  create(id: string, element: HTMLElement | null): Droppable {
    let instance = this.instances[id]
    if (instance) { if (element) instance.addContainer(element); return instance }
    instance = new Droppable(element || [], {
      draggable: '.draggable-source',
      mirror: { constrainDimensions: true, appendTo: document.getElementById('gui') || document.body }
    })
    this.instances[id] = instance
    return instance
  }
}
