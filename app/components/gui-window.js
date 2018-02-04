import GuiDraggable from './gui-draggable';
//const iziModal = requireNode('izimodal');

export default GuiDraggable.extend({
  classNames: ['iziModal'],

  didRender() {
    this._super(...arguments);
  },

  didInsertElement() {
    this._super(...arguments);
  },

  getIzi() {
    if(!this.izi)
      this.izi = this.getElement().iziModal({
        'width': '100%'
      });

    return this.izi;
  },

  bringToFront() {
    this.getElement().css('z-index', '1');
  },

  bringToBack() {
    this.getElement().css('z-index', '0');
  },

  show() {
    // this.getIzi().iziModal('open', {
    //   transitionIn: 'bounceInDown',
    //   transitionOut: 'bounceOutDown'
    // });
  },

  hide() {
  //   this.getIzi().iziModal('close', {
  //     transitionIn: 'bounceInDown',
  //     transitionOut: 'bounceOutDown'
  //   });
  },

  toggle() {
    let visible = this.get('visible');
    this.startAnimation(visible ? 'show-out' : 'show-in', {}, () => {
      this.set('visible', !visible);
    });



    // this.getIzi().iziModal('toggle', {
    //   transitionIn: 'bounceInDown',
    //   transitionOut: 'bounceOutDown'
    // });
  },

  click() {
    this.getManager().bringWindowTop(this);


    //this.hide();

  }


});
