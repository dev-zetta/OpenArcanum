import GuiWidget from '../gui-widget';
const Muuri = requireNode('muuri');

export default GuiWidget.extend({


  didRender() {
    this._super(...arguments);

    let element = this.getElement();

    element.addClass('item');
  },

  click() {

    if (!this.grid) {
      // https://github.com/haltu/muuri
      this.grid = new Muuri(this.get('element'), {
        dragEnabled: true,
        // Layout
        layout: {
          fillGaps: false,
          horizontal: false,
          alignRight: false,
          alignBottom: false,
          rounding: true
        },
        layoutOnResize: 100,
        layoutOnInit: true,
        layoutDuration: 300,
        layoutEasing: 'ease',
        dragStartPredicate: {
          distance: 10,
          delay: 100,
          handle: '.gui-widget'
        },
        //dragContainer: document.body
      });
      console.log('test')
    }

    this.getParent().bringToFront();
    return false;
  },

  dragStart() {
    return false;
  }




});
