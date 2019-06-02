/* global AGate */

import GuiWidget from '../gui-widget'
import { computed } from '@ember/object'

class GuiGauge extends GuiWidget {
  /**
   *
   */
  didRender() {
    super.didRender(...arguments)
  }

  /**
   *
   * @returns {*}
   */
  getMin() {
    return this.getOption(`min`)
  }

  /**
   *
   * @returns {*}
   */
  getMax() {
    return this.getOption(`max`)
  }

  /**
   *
   * @returns {*}
   */
  getOrientation() {
    return this.getOption(`orientation`)
  }

  /**
   *
   */
  getValue() {
    this.get(`value`)
  }

  /**
   *
   * @param value
   */
  setValue(value) {
    this.set(`value`, value)
  }

  /**
   *
   * @param value
   */
  @computed(`widget`, `sprite`)
  get value() {
    return this.get(`widget.value`)
  }

  set value(value) {
    let min = this.getMin()
    let max = this.getMax()

    value = AGate.Utils.clamp(value, min, max)

    let orientation = this.getOrientation()
    let position = this.getPosition()

    let size = this.getSize()
    let sprite = this.get(`sprite`) //this.getSprite()

    let percent = (max - min) * ((value - min) / 100.0)

    let style = {}

    //console.log(this.get('sprite'), this.get('widget.sprite'))
    if (sprite) {
      console.log(`sprite`, orientation)
      let frame = sprite.getFrame()
      switch (orientation) {
        case `horizontal`: {
          let pixels = (frame.width / 100.0) * percent

          //style['width'] = `${pixels}px`;
          style[`background-position-x`] = `-${frame.width - pixels}px`
          style[`background-repeat`] = `no-repeat`

          console.log(pixels, percent, frame.width, size.width)
          break
        }
        case `vertical`: {
          let pixels = (frame.height / 100.0) * percent

          //style['bottom'] = `${position.top + size.height}px`;
          //style['margin-top'] = `${size.height - pixels}px`;
          //style['height'] = `${pixels}px`;

          style[`background-position-y`] = `${frame.height - pixels}px`
          style[`background-repeat`] = `no-repeat`
          break
        }
      }
    }

    this.setStyle(style)

    let placeholder = this.getOption(`placeholder`)
    if (placeholder) {
      placeholder = this.getWidget(placeholder)
      console.log(placeholder)
      if (placeholder) {
        placeholder.setValue(value)
      }
    }

    this.set(`widget.value`, value)
    return value
  }

  /**
   *
   * @returns {boolean}
   */
  click() {
    //let value = this.getValue();
    let min = this.getMin()
    let max = this.getMax()

    let value = Math.floor(Math.random() * max) + min

    this.setValue(value)

    return false
  }
}

export default GuiGauge
