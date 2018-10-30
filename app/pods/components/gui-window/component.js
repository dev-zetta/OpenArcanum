import GuiDraggable from '../gui-draggable'
//const iziModal = requireNode('izimodal');

export default GuiDraggable.extend({
  classNames: ['iziModal'],
  classNameBindings: ['widget.options.toolbar:has-toolbar'],

  didRender() {
    this._super(...arguments)
  },

  didInsertElement() {
    this._super(...arguments)

    /*let options = this.get('widget.options')

    if (!!options && options.toolbar) {
      this.getElement().addClass('toolbar')
    }*/
  },

  didReceiveAttrs() {
    this._super(...arguments)



  },

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
  click() {
    this.getManager().bringWindowTop(this)
    //this.hide();
  }
})
