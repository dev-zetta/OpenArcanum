import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
/* global AGate */

import GuiWidget from '../gui-widget'

class GuiInventoryItem extends GuiWidget {
  classNames = ['gui-widget', 'gui-inventory-item', 'draggable-source']

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

  applySprite() {}

  setEntity(entity) {
    this.entity = entity

    const engine = AGate.engine

    let art = entity.Item ? entity.Item.inventory : entity.Visual.current
    let path = engine.client.getGfxPath(art)
    let url = AGate.getGfxUrl(path)

    //console.error(art, builder.toPath(), url)
    //this.setSprite(url + `/0/North/Sprite`)
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

export default setComponentTemplate(template, GuiInventoryItem)
