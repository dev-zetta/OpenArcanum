import GuiWidget from './gui-widget';

export default GuiWidget.extend({

  getAdvancedPosition(x, y) {
   // let pos = this.getPosition();
    return {left: /*pos.left +*/ x, top: /*pos.top +*/ y};
  },

  createModelsForChildren(definition) {
    let id = this.getId();

    let widgets = [];
    for (let key in definition) {
      let widget = {
        'id': `${id}:${key}`,
        'type': 'gui-widget',
        'attributes': definition[key]
      };

      widgets.push(widget);
    }

    this.get('store').pushPayload('gui-widget', {
      data: widgets
    });
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.setSize(100, 30);

    this.createModelsForChildren({
      'left': {
        type: 'button',
        sprite: 'CharMinus',
        position: this.getAdvancedPosition(0, 0),
        events: {
          onClick(event) {

          }
        }
      },

      'text': {
        type: 'text',
        position: this.getAdvancedPosition(24, -2),
        size: [30, 21] // TODO
      },

      'right': {
        type: 'button',
        sprite: 'CharPlus',
        position: this.getAdvancedPosition(54, 0),
        events: {
          onClick(event) {

          }
        }
      }
    });
  }

});
