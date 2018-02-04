import Component from '@ember/component';
import {Engine} from '../agate/shared/Engine';
import {Manager} from '../agate/client/Gui';

export default Component.extend({
  classNames: ['game-render'],
  store: Ember.inject.service(),
  shouldRender: false,

  init() {
    this._super(...arguments);
  },

  getElement() {
    return this.$();
  },

  getManager() {
    return this._engine.client.guiManager;
  },

  didInsertElement() {
    this._super(...arguments);

    this._engine = Engine.instance;

    let canvas = document.getElementById('render2d');

    this._engine.createClient(canvas).then(() => {
      this.get('store').query('gui-widget', {
        include: 'components',
        filter: {
          type: 'window',
          visible: true
          //id: ['topWin', 'middleWin', 'bottomWin']
        }
      }).then((data) => {
        let manager = this.getManager();
        manager.setRootWidget(this);
        manager.setMouseSprite('cursor');

        this.set('widgets', data);
      });
    });
  },

  mouseMove(event) {
    //this.getManager().onMouseMove(event);
  },

  actions: {},
});
