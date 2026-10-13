import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiDraggable extends GuiWidget {
  x = 0
  y = 0

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

  dragStart(e: DragEvent) {
    //console.log(e)

    let element = this.getElement()

    let x = parseInt(element.css(`left`) || '0') - e.clientX
    let y = parseInt(element.css(`top`) || '0') - e.clientY

    e.dataTransfer!.setData(`position`, `${x},${y}`)
    e.dataTransfer!.setData(`id`, this.widget.id || '')
    //e.preventDefault();

    //AGate.Utils.logError('drag')
    return true
  }

  windowDrop(e: DragEvent) {
    //AGate.Utils.logError('drop')

    let id = e.dataTransfer!.getData(`id`)
    if (id !== this.widget.id || '') {
      return
    }

    let xy = e.dataTransfer!.getData(`position`).split(`,`)
    this.setProperties({ x: e.clientX + parseInt(xy[0]), y: e.clientY + parseInt(xy[1]) })
    this.positionChanged()
  }

  windowDragOver(e: DragEvent) {
    e.preventDefault()
  }

  didInsertElement() : this {
    super.didInsertElement()
  
    return this
  }

  // Remember to unbind the document event handlers
  didDestroyElement() : this {
    return this
  }
}

setComponentTemplate(template, GuiDraggable)
export default GuiDraggable
