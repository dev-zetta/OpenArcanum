import GuiDraggable from './gui-draggable'
//const iziModal = requireNode('izimodal');
import GuiWidget from './gui-widget'

export default GuiWidget.extend({
  classNames: ['iziModal'],

  /*didRender() {
    this._super(...arguments)
  },

  didInsertElement() {
    this._super(...arguments)
  },

  didReceiveAttrs() {
    this._super(...arguments)
  },*/

  /**
   *
   * @returns {*}
   */
  getIzi() {
    if (!this.izi)
      this.izi = this.getElement().iziModal({
        width: '100%'
      })

    return this.izi
  },

  /**
   *
   */
  bringToFront() {
    this.getElement().css('z-index', '1')
  },

  /**
   *
   */
  bringToBack() {
    this.getElement().css('z-index', '0')
  },

  /**
   *
   * @param animation
   */
  show(animation = 'show-in') {
    if (this.isVisible()) {
      return
    }

    this.startAnimation(animation, {}, () => {
      this.setVisibility(true)
    })
  },

  /**
   *
   * @param animation
   */
  hide(animation = 'show-out') {
    if (!this.isVisible()) {
      return
    }

    this.startAnimation(animation, {}, () => {
      this.setVisibility(false)
    })
  },

  /**
   *
   * @param animation
   */
  toggle(animation = ['show-in', 'show-out']) {
    let visible = this.isVisible()
    this.startAnimation(visible ? animation[1] : animation[0], {}, () => {
      this.setVisibility(!visible)
    })
  },

  /**
   *
   */
  click() {
    this.getManager().bringWindowTop(this)
    //this.hide();
  }
})
