import Component from '@ember/component'
import { inject as service } from '@ember/service';

import { Engine } from 'open-arcanum/agate/shared/Engine'
import { Manager } from 'open-arcanum/agate/client/Gui'

export default Component.extend({
  classNames: ['game-render'],
  store: service(),
  shouldRender: false,

  /**
   *
   */
  init() {
    this._super(...arguments)
    console.log('xxxxxxxxxxxx')
  },

  /**
   *
   */
  getElement() {
    return this.$()
  },

  /**
   *
   * @returns {Manager}
   */
  getManager() {
    return this.engine.client.guiManager
  },

  /**
   *
   */
  didInsertElement() {

    this._super(...arguments)

    Engine.instance = new Engine()
    this.engine = Engine.instance

    let canvas = document.getElementById('render2d')

    this.engine.createClient(canvas).then(() => {
      this.get('store')
        .query('gui-widget', {
          include: 'components,components.components',
          filter: {
            type: 'window',
            //visible: true
            //id: ['topWin', 'middleWin', 'bottomWin']
          }
        })
        .then(data => {
          let manager = this.getManager()
          manager.setRootWidget(this)
          manager.setMouseSprite('cursor')

          this.set('widgets', data)
        })
    })
  },

  /**
   *
   * @param event
   */
  mouseMove(event) {
    //this.getManager().onMouseMove(event);
  },

  actions: {}
})
