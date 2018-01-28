import GuiWidget from './gui-widget';

export default GuiWidget.extend({
  classNameBindings: ['active', 'disabled'],

  bubble: false,
  active: false,
  disabled: false,

  onClick: null,

  /**
   *
   */
  click() {
    let action = this.get('onClick');
    if (action !== null) {
      let promise = (action)(this.get('value'));
      if (promise && typeof promise.then === 'function' && !this.get('isDestroyed')) {
        this.set('textState', 'pending');
        promise.then(() => {
            if (!this.get('isDestroyed')) {
              this.set('textState', 'resolved');
            }
          }, () => {
            if (!this.get('isDestroyed')) {
              this.set('textState', 'rejected');
            }
          }
        );
      }
      return this.get('bubble');
    }
  },


  mouseEnter() {
    this.changeFrame(2);
  },

  mouseLeave() {
    this.changeFrame(0);
  },

  mouseDown() {
    this.changeFrame(1);
  },

  mouseUp() {
    this.changeFrame(2);
  },

});
