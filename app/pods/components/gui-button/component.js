import GuiWidget from '../gui-widget'

import { className, attribute } from '@ember-decorators/component'

class GuiButton extends GuiWidget {
  @className(`active`)
  disabled = false

  bubble = false
  active = false
  disabled = false
  onClick = null
  toggled = false

  /**
   *
   */
  click(e) {
    super.click(...arguments)

    let action = this.get(`onClick`)
    if (action !== null) {
      let promise = action(this.get(`value`))
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

  mouseEnter() {
    if (!this.get(`toggled`)) {
      this.changeFrame(2)
    }
  }

  mouseLeave() {
    if (!this.get(`toggled`)) {
      this.changeFrame(0)
    }
  }

  mouseDown() {
    if (!this.get(`toggled`)) {
      this.changeFrame(1)
    }
  }

  mouseUp() {
    if (!this.get(`toggled`)) {
      this.changeFrame(2)
    }
  }
}

export default GuiButton
