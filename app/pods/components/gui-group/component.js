import GuiWidget from '../gui-widget'

import { className, attribute } from '@ember-decorators/component';


class GuiGroup extends GuiWidget {

  @className(`active`)
  @className(`disabled`)


  @attribute
  bubble = false

  @attribute
  active = false

  @attribute
  disabled = false

  @attribute
  onClick = null

  /**
   *
   */
  click(e) {
    this.emitOwnEvent(`click`)

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

  /*mouseEnter() {
    this.changeFrame(2)
  },

  mouseLeave() {
    this.changeFrame(0)
  },

  mouseDown() {
    this.changeFrame(1)
  },

  mouseUp() {
    this.changeFrame(2)
  }*/
}

export default GuiGroup
