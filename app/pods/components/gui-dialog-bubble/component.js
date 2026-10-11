import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import { utils as runtimeUtils } from 'open-arcanum/lib/runtime'
/* global AGate */

const Utils = runtimeUtils

import GuiWidget from '../gui-widget'

class GuiDialogBubble extends GuiWidget {
  classNames = ['gui-widget', 'gui-dialog-bubble', 'dialog-bubble']

  /**
   *
   * @type {null}
   */
  entity = null

  /**
   *
   */
  constructor() {
    super(...arguments)
  }

  setEntity(entity) {
    this.entity = entity
    //
    // let path = AGate.client.getGfxPath(art)
    // let url = AGate.getGfxUrl(path)

    //console.error(art, builder.toPath(), url)
    //this.setSprite(url + `/0/North/Sprite`)
  }

  /**
   *
   * @param value
   */
  setValue(value) {
    if (Utils.isArray(value)) {
      value = value.join(`<hr/>`)
    }

    this.set(`widget.value`, value)
  }


  aiActionsToString(actions, indent = '') {
    if (!actions) {
      return ''
    }

    let result = ''
    for (let [name, action] of actions) {
      result += indent + action.toString() + "<br />"
      result += this.aiActionsToString(action.actions, indent + ">>")
    }

    return result
  }

  // aiActionsToString(actions, output) {
  //   if (!actions) {
  //     return []
  //   }
  //
  //   let result = []
  //   for (let [name, action] of actions) {
  //     result.push(action.toString())
  //     let child = this.aiActionsToString(action.actions)
  //     if (child.length > 0) {
  //       result.push(child)
  //     }
  //   }
  //
  //   return result
  // }
  //
  //

  update(entity = this.entity) {

    let {visual, critter} = entity

    if (!visual) {
      return
    }

    let {classes} = visual
    if (!classes) {
      return
    }


    let { sprite } = classes.current
    if (!sprite) {
      return
    }



    let position = sprite.getGlobalPosition()

    let clientRect = this.element.getBoundingClientRect()

    let bubbleWidth = clientRect.width
    let bubbleHeight = clientRect.height


    let data = [
      this.aiActionsToString(critter.aiState.actions),
      classes.current.animation

    ]

    this.setValue(data) // `${position.x}, ${position.y}`
    this.setPosition(position.x - bubbleWidth /2, position.y - bubbleHeight)
  }
}

export default setComponentTemplate(template, GuiDialogBubble)
