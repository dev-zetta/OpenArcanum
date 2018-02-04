import GuiWidget from './gui-widget';
import AGate from '../agate/agate';

export default GuiWidget.extend({
  value: "100",

  setValue(value) {
    if (AGate.Utils.isArray(value)) {
      value = value.join('\n');
    }

    this.set("value", value);
  },

  click() {
    return false;
  }

});
