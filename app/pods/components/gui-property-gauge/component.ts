import type { WidgetDefinition } from '../../../types/widgets'
import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiPropertyGauge extends GuiWidget {
  //@alias('gauge.value') setValue

  default: WidgetDefinition = {
    value: 100
  }

  gauge = null
  left = null
  right = null

  /**
   *
   * @param amount
   */
  adjustValue(amount: number) {
    let value = (Number(this.widget.value) || 0) + amount
    this.set(`widget.value`, value)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*[]}
   */
  getAdvancedPosition(x: number, y: number): [number, number] {
    let pos = this.getPosition()
    return [x, y]
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs()

    let self = this
    this.createModelsForChildren({
      label: {
        type: `text`,
        position: this.getAdvancedPosition(0, -21),
        size: [60, 20],
        value: this.getOption(`title`)
      },

      counter: {
        type: `text`,
        size: [60, 20],
        position: `center`,
        style: {
          zIndex: 1,
          textAlign: `center`
        }
      },

      left: {
        type: `button`,
        sprite: `SkilMinusBut`,
        position: this.getAdvancedPosition(0, 0),
        options: {},
        events: {
          click(_event) {
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
          click(_event) {
            self.adjustValue(+1)
          }
        }
      }
    })
  }
}

setComponentTemplate(template, GuiPropertyGauge)
export default GuiPropertyGauge
