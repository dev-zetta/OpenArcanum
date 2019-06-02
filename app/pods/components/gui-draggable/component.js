import GuiWidget from '../gui-widget'
import { observes } from '@ember-decorators/object'

class GuiDraggable extends GuiWidget {
  x = 0
  y = 0

  @observes(`x`, `y`)
  positionChanged() {
    //AGate.Utils.logError('func')
    let x = this.get(`x`)
    let y = this.get(`y`)

    this.getElement().css({
      left: `${x}px`,
      top: `${y}px`
    })

    this.set(`widget.position`, {
      left: `${x}`,
      top: `${y}`
    })
  }

  dragStart(e) {
    //console.log(e)

    let element = this.getElement()

    let x = parseInt(element.css(`left`)) - e.clientX
    let y = parseInt(element.css(`top`)) - e.clientY

    e.dataTransfer.setData(`position`, `${x},${y}`)
    e.dataTransfer.setData(`id`, this.get(`widget.id`))
    //e.preventDefault();

    //AGate.Utils.logError('drag')
    return true
  }

  windowDrop(e) {
    //AGate.Utils.logError('drop')

    let id = e.dataTransfer.getData(`id`)
    if (id !== this.get(`widget.id`)) {
      return
    }

    let xy = e.dataTransfer.getData(`position`).split(`,`)
    this.setProperties({
      x: `${e.clientX + parseInt(xy[0])}`,
      y: `${e.clientY + parseInt(xy[1])}`
    })
  }

  windowDragOver(e) {
    e.preventDefault()
  }

  didInsertElement() {
    super.didInsertElement(...arguments)
  }

  // Remember to unbind the document event handlers
  didDestroyElement() {}
}

export default GuiDraggable
