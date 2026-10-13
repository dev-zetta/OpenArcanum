import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import { utils as runtimeUtils } from 'open-arcanum/lib/runtime'
const Utils = runtimeUtils

import GuiWidget from '../gui-widget'

class GuiText extends GuiWidget {
  setValue(value: unknown) {
    if (Utils.isArray(value)) {
      value = value.join(`\n`)
    }

    this.set(`widget.value`, value)
  }

  click() {
    return false
  }
}

setComponentTemplate(template, GuiText)
export default GuiText
