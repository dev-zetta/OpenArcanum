import GuiWidget from '../gui-widget'

class GuiNumberSpinner extends GuiWidget {
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
   * @param amount
   */
  adjustValue(amount) {
    let text = this.get(`text`)
    let value = text.get(`value`) + amount
    text.set(`value`, value)
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    let options = this.get(`options`)
    let self = this
    this.createModelsForChildren({
      left: {
        type: `button`,
        sprite: `CharMinus`,
        position: this.getAdvancedPosition(0, 0),
        options: {},
        events: {
          click(event) {
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
          click(event) {
            self.adjustValue(+1)
          }
        }
      }
    })
  }
}

export default GuiNumberSpinner
