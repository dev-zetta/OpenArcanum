import GuiWidget from '../gui-widget'
import EmberObject, {
  computed,
  observer
} from '@ember/object';

export default GuiWidget.extend({
  x: 0,
  y: 0,

  positionChanged: observer('x', 'y', function() {
    //AGate.Utils.logError('func')
    let x = this.get('x')
    let y = this.get('y')

    this.getElement().css({
      left: `${x}px`,
      top: `${y}px`
    })

    this.set('widget.position', {
      left: `${x}`,
      top: `${y}`
    })
  }),

  dragStart(e) {
    let element = this.getElement()

    let x = parseInt(element.css('left')) - e.clientX
    let y = parseInt(element.css('top')) - e.clientY

    e.dataTransfer.setData('position', `${x},${y}`)
    e.dataTransfer.setData('id', this.get('widget.id'))
    //e.preventDefault();

    //AGate.Utils.logError('drag')
    return true
  },

  windowDrop(e) {
    //AGate.Utils.logError('drop')

    let id = e.dataTransfer.getData('id')
    if (id !== this.get('widget.id')) return

    let xy = e.dataTransfer.getData('position').split(',')
    this.setProperties({
      x: `${e.clientX + parseInt(xy[0])}`,
      y: `${e.clientY + parseInt(xy[1])}`
    })
  },

  windowDragOver(e) {
    e.preventDefault()

    //AGate.Utils.logError('dragover')
  },

  didInsertElement() {
    this._super(...arguments)

    this.set('draggable', 'true')

    this.getParent()
      .getElement()
      .on('drop', $.proxy(this.windowDrop, this))
      .on('dragover', $.proxy(this.windowDragOver, this))
  },

  // Remember to unbind the document event handlers
  didDestroyElement() {
    this.getParent()
      .getElement()
      .off('drop')
      .off('dragover')
  }
})
