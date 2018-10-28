import GuiWidget from './gui-widget'

export default GuiWidget.extend({
  getAdvancedPosition(x, y) {
    let pos = this.getPosition()
    return [x, y]
  },

  didReceiveAttrs() {
    this._super(...arguments)

    this.setSize(100, 30)

    this.createModelsForChildren({
      left: {
        type: 'button',
        sprite: 'CharMinus',
        position: this.getAdvancedPosition(0, 0),
        events: {
          onClick(event) {
            alert('test')
          }
        }
      },

      text: {
        type: 'text',
        position: this.getAdvancedPosition(24, -2),
        size: [30, 21] // TODO
      },

      right: {
        type: 'button',
        sprite: 'CharPlus',
        position: this.getAdvancedPosition(54, 0),
        events: {
          onClick(event) {}
        }
      }
    })
  }
})
