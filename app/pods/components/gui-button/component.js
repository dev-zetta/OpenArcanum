import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'

import { action } from '@ember/object'

class GuiButton extends GuiWidget {
  classNameBindings = ['active', 'disabled']


  bubble = false
  active = false
  disabled = false
  //onClick = null
  toggled = false

  onClick = null

  didInsertElement() {
    super.didInsertElement(...arguments);
    this.element.addEventListener('mouseenter', this.onMouseEnter)
    this.element.addEventListener('mouseleave', this.onMouseLeave)
    this.element.addEventListener('mousedown', this.onMouseDown)
    this.element.addEventListener('mouseup', this.onMouseUp)
  }

  willDestroyElement() {
    super.willDestroyElement(...arguments);
    this.element.removeEventListener('mouseenter', this.onMouseEnter)
    this.element.removeEventListener('mouseleave', this.onMouseLeave)
    this.element.removeEventListener('mousedown', this.onMouseDown)
    this.element.removeEventListener('mouseup', this.onMouseUp)
  }

  /**
   *
   */
  @action
  click(e) {
    e?.stopPropagation()
    super.click(...arguments)

    let action2 = this.get(`onClick`)
    if (action2 !== null) {
      let promise = action2(this.get(`value`))
      if (
        promise &&
        typeof promise.then === `function` &&
        !this.get(`isDestroyed`)
      ) {
        this.set(`textState`, `pending`)
        promise.then(
          () => {
            if (!this.get(`isDestroyed`)) {
              this.set(`textState`, `resolved`)
            }
          },
          () => {
            if (!this.get(`isDestroyed`)) {
              this.set(`textState`, `rejected`)
            }
          }
        )
      }
      return this.get(`bubble`)
    }
  }

  toggle() {
    let toggled = this.get(`toggled`)
    this.changeFrame(toggled ? 2 : 1)
    this.set(`toggled`, !toggled)
  }

  @action
  onMouseEnter() {
    if (!this.get(`toggled`)) {
      this.changeFrame(2)
    }
  }

  @action
  onMouseLeave() {
    if (!this.get(`toggled`)) {
      this.changeFrame(0)
    }
  }

  @action
  onMouseDown() {
    if (!this.get(`toggled`)) {
      this.changeFrame(1)
    }
  }

  @action
  onMouseUp() {
    if (!this.get(`toggled`)) {
      this.changeFrame(2)
    }
  }
}

export default setComponentTemplate(template, GuiButton)
