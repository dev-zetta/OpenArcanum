/* global AGate */

import GuiWidget from '../gui-widget'
import { classNames, className, attribute } from '@ember-decorators/component'

import {GfxPathBuilder} from 'open-arcanum/agate/shared/assets'

@classNames('draggable-source')
class GuiInventoryItem extends GuiWidget {

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

  applySprite() {

  }

  setEntity(entity) {
    this.entity = entity

    let art = entity.Item ? entity.Item.inventory : entity.Visual.current
    let builder = new GfxPathBuilder(art)
    let url = AGate.getGfxUrl(builder.toPath())

    //console.error(art, builder.toPath(), url)
    this.setSprite(url + '/0/North/Sprite.gif')
  }



  /*drag(e) {
    //e.preventDefault()
    console.error(`drag`)
    return false
  }*/

  /**
   *
   * @param e
   * @returns {boolean}
   */
  /*dragStart(e) {
    //e.preventDefault()

    console.error(`dragStart`)
    return false
  }*/

  /**
   *
   * @returns {boolean}
   */
  /*dragOver() {
    console.error(`dragOver`)
    return false
  }*/

  /**
   *
   * @param e
   */
  /*drop(e) {
    console.error(`drop`)
    //let id = event.dataTransfer.getData('text/data');
    //this.get('action')(id);
  }*/


}

export default GuiInventoryItem
