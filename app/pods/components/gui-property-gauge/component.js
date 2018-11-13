import GuiWidget from '../gui-widget'
import {alias, overridableReads} from '@ember-decorators/object/computed'

class GuiPropertyGauge extends GuiWidget {
  //@alias('gauge.value') setValue

  default = {
    value: 100
  }

  gauge = null
  left = null
  right = null

  /**
   *
   * @param amount
   */
  adjustValue(amount) {
    let value = this.get(`widget.value`) + amount
    this.set(`widget.value`, value)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*[]}
   */
  getAdvancedPosition(x, y) {
    let pos = this.getPosition()
    return [x, y]
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    let self = this
    this.createModelsForChildren({
      label: {
        type: `text`,
        position: this.getAdvancedPosition(0, -21),
        size: [60, 20],
        value: this.getOption('title')
      },

      counter: {
        type: `text`,
        position: this.getAdvancedPosition(0, 0),
        size: [60, 20],
        position: 'center',
        style: {
          zIndex: 1,
          textAlign: 'center'
        }
      },

      left: {
        type: `button`,
        sprite: `SkilMinusBut`,
        position: this.getAdvancedPosition(0, 0),
        options: {},
        events: {
          click(event) {
            self.adjustValue(-1)
          }
        }
      },

      gauge: {
        type: `gauge`,
        position: this.getAdvancedPosition(40, 3),
        sprite: `SkilGauge`,
        value: this.get(`widget.value`),
        options: {
          min: 0,
          max: 100,
          orientation: `horizontal`,
          placeholder: this.makeChildId(`counter`)
        }
      },

      right: {
        type: `button`,
        sprite: `SkilAddBut`,
        position: this.getAdvancedPosition(175, 0),
        events: {
          click(event) {
            self.adjustValue(+1)
          }
        }
      }
    })
  }
}

export default GuiPropertyGauge
