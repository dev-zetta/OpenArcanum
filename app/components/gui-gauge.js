/* global AGate */

import GuiWidget from './gui-widget';
import {Math} from '../agate/shared/misc/Math';

export default GuiWidget.extend({


  didRender() {
    this._super(...arguments);
  },

  getMin() {
    return this.get('widget.options.min');
  },

  getMax() {
    return this.get('widget.options.max');
  },

  getOrientation() {
    return this.get('widget.options.orientation');
  },

  getValue() {
    this.get('widget.value');
  },

  setValue(value) {
    let min = this.getMin();
    let max = this.getMax();

    value =  AGate.Utils.clamp(value, min, max);

    let orientation = this.getOrientation();
    let position = this.getPosition();

    let size = this.getSize();
    let sprite = this.getSprite();
    let frame = sprite.getFrame();

    let percent = (max - min)  * ((value - min) / 100.0);


    let style = {};
    switch (orientation) {
      case 'horizontal': {
        let pixels = (frame.width / 100.0) * percent;

        //style['width'] = `${pixels}px`;
        style['background-position-x'] = `-${(frame.width - size.width) - pixels}px`;
        style['background-repeat'] = 'no-repeat';
        break;
      }
      case 'vertical': {
        let pixels = (frame.height / 100.0) * percent;

        //style['bottom'] = `${position.top + size.height}px`;
        //style['margin-top'] = `${size.height - pixels}px`;
        //style['height'] = `${pixels}px`;

        style['background-position-y'] = `${frame.height - pixels}px`;
        style['background-repeat'] = 'no-repeat';
        break;
      }
    }

    this.setStyle(style);

    let placeholder = this.get('widget.options.placeholder');
    if (placeholder) {
      placeholder = this.getWidget(placeholder);
      if (placeholder)
        placeholder.setValue(value);

    }

  },

  click() {
    //let value = this.getValue();
    let min = this.getMin();
    let max = this.getMax();

    let value = Math.floor(Math.random() * max) + min;

    this.setValue(value);

    return false;
  }



});
