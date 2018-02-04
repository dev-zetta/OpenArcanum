import GuiWidget from './gui-widget';
import Ember from 'ember';

export default GuiWidget.extend({

  x: 0,
  y: 0,

  positionChanged: Ember.observer('x', 'y', function(){
    let x = this.get('x');
    let y = this.get('y');

    this.getElement().css({
      left: `${x}px`,
      top: `${y}px`,
    });

    this.set('widget.position', {
      left: `${x}`,
      top: `${y}`,
    });
  }),

  dragStart(e) {
    let element = this.getElement();

    let x = parseInt(element.css('left')) - e.originalEvent.clientX;
    let y = parseInt(element.css('top')) - e.originalEvent.clientY;

    e.originalEvent.dataTransfer.setData("position", `${x},${y}`);
    e.originalEvent.dataTransfer.setData("id", this.get('widget.id'));
  },

  windowDrop(e) {
    let id = e.dataTransfer.getData("id");
    if (id !== this.get('widget.id'))
      return;

    let xy = e.dataTransfer.getData("position").split(',');
    this.setProperties({
      x: `${e.originalEvent.clientX + parseInt(xy[0])}`,
      y: `${e.originalEvent.clientY + parseInt(xy[1])}`,
    });
  },

  windowDragOver(e) {
    e.originalEvent.preventDefault();
  },

  didRender() {
    this._super(...arguments);

    this.set('draggable', 'true');

    this.getParent().getElement()
    .on('drop', $.proxy(this.windowDrop, this))
    .on('dragover', $.proxy(this.windowDragOver, this));
  },

  // Remember to unbind the document event handlers
  didDestroyElement() {
    this.getParent().getElement()
    .off('drop')
    .off('dragover');
  },



});
