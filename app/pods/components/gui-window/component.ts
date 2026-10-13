import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import { utils as runtimeUtils } from 'open-arcanum/lib/runtime'
import GuiWidget from '../gui-widget'
import {  action, computed } from '@ember/object'

import { jsPanel, type Panel } from 'jspanel4'

const Utils = runtimeUtils

class GuiWindow extends GuiWidget {
  jsPanel?: Panel
  clickedOnToolbar = false
  classNameBindings = ['hasToolbar:has-toolbar']
  attributeBindings = ['dataId:data-id', 'tooltip:title', 'isDraggable:draggable']


  @computed
  get hasToolbar() {
    return this.getOption(`toolbar`)
  }

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
    super.didRender()
  }

  /**
   *
   */
  didInsertElement() : this {
    super.didInsertElement()

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
          panel.style.display = !this.isHidden() ? `flex` : `none`

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
  
    return this
  }

  /**
   *
   */
  didReceiveAttrs() {
    super.didReceiveAttrs()

    if (this.jsPanel) {
    }
  }

  /**
   *
   * @param e
   * @returns {boolean}
   */
  mouseDown(e?: MouseEvent) {
    this.clickedOnToolbar = e?.target instanceof Element && e.target.className === `toolbar`

    if (!this.clickedOnToolbar) {
      //super.mouseDown()
    }

    return true // this.clickedOnToolbar
  }

  /**
   *
   * @param e
   * @returns {boolean|*}
   */
  dragStart(e: DragEvent) {
    //console.log('drag start')

    if (this.clickedOnToolbar) {
      super.dragStart(e)
    }

    return this.clickedOnToolbar
  }

  /**
   *
   */
  click() {
    super.click()
    this.getManager().bringWindowTop(this)
    return false
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
  setVisibility(visible: boolean) {
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

setComponentTemplate(template, GuiWindow)
export default GuiWindow
