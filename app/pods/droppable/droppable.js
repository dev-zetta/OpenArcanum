import ShopifyDraggable from '@shopify/draggable'
const { Droppable, Plugins } = ShopifyDraggable

// https://github.com/Shopify/draggable/tree/master/src/Draggable

export default class MyDroppable extends Droppable {
  /*methods = [
    `on`,
    `off`,
    `trigger`,
    `addPlugin`,
    `removePlugin`,
    `addSensor`,
    `removeSensor`,
    `addContainer`,
    `removeContainer`,
    `getClassNameFor`,
    `isDragging`,
    `getDraggableElementsForContainer`
  ]

  events = [
    `draggable:initialize`,
    `draggable:destroy`,
    `drag:start`,
    `drag:move`,
    `drag:over`,
    `drag:over:container`,
    `drag:out`,
    `drag:out:container`,
    `drag:stop`,
    `drag:pressure`,

    `droppable:dropped`,
    `droppable:returned`
  ]*/

  dropZones = []

  constructor(container, options) {
    const dropzone = () =>
      //console.error(this.dropZones)
      this.dropZones

    super(container, Object.assign(options, {dropzone}))

    /*for (let name of this.methods) {
      this[name] = (...args) => this.draggable[name](...args)
    }*/
  }

  destroy() {
    this.draggable.destroy()
  }

  addDropzone(element) {
    let index = this.dropZones.indexOf(element)
    if (index === -1) {
      this.dropZones.push(element)
    }
  }

  removeDropzone(element) {
    let index = this.dropZones.indexOf(element)
    if (index !== -1) {
      this.dropZones.splice(index, 1)
    }
  }
}
