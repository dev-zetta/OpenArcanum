import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import { action } from '@ember/object'

import GuiWidget from '../gui-widget'

class GuiCheckbox extends GuiWidget {
  myValue = false

  @action
  handleInputClick(event: Event) {
    // The classic wrapper's click handler cancels default actions. Let the
    // native checkbox toggle before its change handler updates the GUI model.
    event.stopPropagation()
  }

  @action
  updateChecked(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return
    this.set('myValue', event.target.checked)
    this.set('widget.value', event.target.checked)
  }
}

setComponentTemplate(template, GuiCheckbox)
export default GuiCheckbox
