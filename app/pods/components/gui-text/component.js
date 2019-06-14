/* global AGate */

import GuiWidget from '../gui-widget'

class GuiText extends GuiWidget {
  setValue(value) {
    if (Utils.isArray(value)) {
      value = value.join(`\n`)
    }

    this.set(`widget.value`, value)
  }

  click() {
    return false
  }
}

export default GuiText
