import GuiWidget from './gui-widget';
import {Math} from '../agate/shared/Math';
import AGate from '../agate/agate';

export default GuiWidget.extend({

  getMin() {
    return this.get('widget.min');
  },

  getMax() {
    return this.get('widget.max');
  },

  getValue() {
    this.get('widget.value');
  },

  getOrientation() {
    return this.get('widget.orientation');
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

    let element = this.getElement();
    element.css(style);
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
