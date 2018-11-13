import GuiWidget from '../gui-widget'
import { classNames, className, attribute } from '@ember-decorators/component'

@classNames('draggable-source')
class GuiInventoryItem extends GuiWidget {
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
