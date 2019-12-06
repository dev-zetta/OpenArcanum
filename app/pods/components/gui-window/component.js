import GuiWidget from '../gui-widget'
import { attribute, classNames, className } from '@ember-decorators/component'
import {  action, computed } from '@ember/object'

let jsPanel = requireNode(`jspanel4/dist/jspanel`)

const Utils = AGate.Utils

@classNames(``)
class GuiWindow extends GuiWidget {
  @className(`has-toolbar`)
  @computed
  get hasToolbar() {
    return this.getOption(`toolbar`)
  }

  @attribute(`draggable`)
  @computed
  get isDraggable() {
    return this.getOption(`toolbar`)
  }

  applyPosition() {
    let position = this.getPosition()
    if (!this.getOption(`toolbar`) || !Utils.isString(position)) {
      super.applyPosition()
    }
  }

  /**
   *
   */
  didRender() {
    super.didRender(...arguments)
  }

  /**
   *
   */
  didInsertElement() {
    super.didInsertElement(...arguments)

    /*let options = this.get('widget.options')

    if (!!options && options.toolbar) {
      this.getElement().addClass('toolbar')
    }*/

    let element = this.get(`element`)

    let hasToolbar = this.getOption(`toolbar`)
    if (hasToolbar && element && !this.jsPanel) {
      let size = this.getSize()
      this.jsPanel = jsPanel.create({
        //theme: `arcanum`,
        //header: `auto-show-hide`,
        headerLogo: `<span class="title-icon mm-skull"></span>`,
        headerTitle: this.getOption(`title`),
        headerControls: { maximize: `remove` },
        position: this.getPosition(),
        contentSize: size,
        content: element,
        dragit: {
          snap: true
        },
        //container: this.getParent(),
        resizeit: this.getOption(`resizable`),
        contentOverflow: `hidden`,
        callback: (panel) => {
          panel.style.display = this.isVisible() ? `flex` : `none`

          panel.titlebar.addEventListener(`dblclick`, () => {
            if (panel.status !== `minimized`) {
              panel.minimize()
            } else {
              panel.normalize()
            }
          })
        },
        onbeforeclose: () => {
          this.toggle()
          return false
        }
      })
    }
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    if (this.jsPanel) {
    }
  }

  /**
   *
   * @param e
   * @returns {boolean}
   */
  mouseDown(e) {
    this.clickedOnToolbar = e.target.className === `toolbar`

    if (!this.clickedOnToolbar) {
      //super.mouseDown(...arguments)
    }

    return true // this.clickedOnToolbar
  }

  /**
   *
   * @param e
   * @returns {boolean|*}
   */
  dragStart(e) {
    //console.log('drag start')

    if (this.clickedOnToolbar) {
      super.dragStart(...arguments)
    }

    return this.clickedOnToolbar
  }

  /**
   *
   */
  click() {
    super.click(...arguments)
    this.getManager().bringWindowTop(this)
  }

  /**
   *
   */
  @action
  close() {
    this.toggle()
  }

  /**
   *
   * @param visible
   * @param fade
   */
  setVisibility(visible) {
    let display
    if (visible) {
      display = `flex`
      this.emitOwnEvent(`shown`)
    } else {
      display = `none`
      this.emitOwnEvent(`hidden`)
    }

    if (this.jsPanel) {
      this.jsPanel.style.display = display
    }

    this.set(`widget.visible`, visible)
  }
}

export default GuiWindow
