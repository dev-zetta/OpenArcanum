import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

class GuiNumberSpinner extends GuiWidget {
  declare text: import('../../../models/gui-widget').default
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
   * @param amount
   */
  adjustValue(amount: number) {
    let text = this.get(`text`)
    let value = (Number(text.value) || 0) + amount
    text.set(`value`, value)
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs()

    let options = this.getOptions()
    let self = this
    this.createModelsForChildren({
      left: {
        type: `button`,
        sprite: `CharMinus`,
        position: this.getAdvancedPosition(0, 0),
        options: {},
        events: {
          click(_event) {
            self.adjustValue(-1)
          }
        }
      },

      text: {
        type: `text`,
        position: this.getAdvancedPosition(23, -2),
        size: [30, 21],
        value: options ? options.value || 0 : 0,
        style: {
          textAlign: `center`,
          lineHeight: `21px`
        }
      },

      right: {
        type: `button`,
        sprite: `CharPlus`,
        position: this.getAdvancedPosition(54, 0),
        events: {
          click(_event) {
            self.adjustValue(+1)
          }
        }
      }
    })
  }
}

setComponentTemplate(template, GuiNumberSpinner)
export default GuiNumberSpinner
