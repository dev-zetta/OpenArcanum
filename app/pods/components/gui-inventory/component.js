import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'
//const Muuri = requireNode(`muuri`)

import { service } from '@ember/service'

class GuiInventory extends GuiWidget {
  @service
  droppable

  /**
   *
   */
  didRender() {
    super.didRender(...arguments)

    let element = this.getElement()

    //element.addClass('item');
  }

  /**
   *
   */
  didInsertElement() {
    super.didInsertElement(...arguments)
  }

  /**
   *
   * @returns {boolean}
   */
  click() {
    this.getParent().bringToFront()
    return false
  }

  hasGrid() {
    return this.instance
  }

  getGrid(settings) {
    if (this.hasGrid()) {
      return this.instance
    }

    let options = this.getOptions()
    let connectWith = options.connectWith

    let element = this.get(`element`)

    let droppable = this.get(`droppable`)

    switch (options.type) {
      case `slots`: {
        /*for (let id of connectWith) {
          let widget = this.getWidget(id)
          if (widget ) {
            this.instance.addDropzone(widget.get(`element`))
          }
        }*/
        this.instance = droppable.create(`inventory`, null)
        break
      }
      default: {
        this.instance = droppable.create(`inventory`, element)
        break
      }
    }

    return this.instance
  }

  addSlots(slots) {
    this.slots = slots

    let parentId = this.getId()
    let grid = this.getGrid()

    console.error(`adding`)

    for (let id in slots) {
      let slot = slots[id]

      let options = this.getOptions()
      let slotSize = options ? options.slotSize : 31

      let size = slot.size ? slot.size : [1, 1]

      let data = {
        id: `${parentId}.${id}`,
        type: `inventory-slot`,
        size: [slotSize * size[0], slotSize * size[1]],
        sprite: slot.sprite,
        position: slot.position,
        events: {
          created() {
            console.error(`grid`)
            let element = this.get(`element`)
            grid.addDropzone(element)
          }
        }
      }

      let widget = this.createChild(data)
    }
  }

  addItems(items) {
    let parentId = this.getId()
    let grid = this.getGrid()

    for (let id in items) {
      let item = items[id]

      let options = this.getOptions()
      let slotSize = options ? options.slotSize : 31

      let size = item.size ? item.size : [1, 1]

      let data = {
        id: `${parentId}.${id}`,
        type: `inventory-item`,
        size: [slotSize * size[0], slotSize * size[1]],
        //sprite: item.sprite,
        events: {
          created() {
            this.setEntity(item.entity)
          }
        }
      }

      let widget = this.createChild(data)
    }
  }
}

export default setComponentTemplate(template, GuiInventory)
