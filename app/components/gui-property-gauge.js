import GuiWidget from './gui-widget';

export default GuiWidget.extend({

  getAdvancedPosition(x, y) {
    let pos = this.getPosition();
    return [ x,  y];
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.setSize(100, 30);

    this.createModelsForChildren({
      'left': {
        type: 'button',
        sprite: 'SkilMinusBut',
        position: this.getAdvancedPosition(0, 0),
        events: {
          onClick(event) {
            alert('test');
          }
        }
      },

      'gauge': {
        type: 'gauge',
        position: this.getAdvancedPosition(40, 0),
        sprite: 'SkilGauge'
      },

      'right': {
        type: 'button',
        sprite: 'SkilAddBut',
        position: this.getAdvancedPosition(175, 0),
        events: {
          onClick(event) {

          }
        }
      }
    });
  }

});
