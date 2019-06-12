/* global AGate */

import Component from '@ember/component'
import { classNames } from '@ember-decorators/component'
import { inject as service } from '@ember/service'
import { action } from '@ember/object'

@classNames(`game-render`)
class GameRender extends Component {

  @service
  store

  @service
  resize

  //@attribute
  shouldRender = false

  @action
  onClick() {

  }

  /**
   *
   */
  constructor() {
    super(...arguments)

   this.get(`resize`).on(`didResize`, event => {
      this.engine.events.emitUI(
        `window.resize`
      )
    })
  }

  /**
   *
   */
  getElement() {
    return this.get(`element`)
  }

  /**
   *
   * @returns {Manager}
   */
  getManager() {
    return this.engine.client.guiManager
  }

  /**
   *
   * @returns {Promise<*>}
   */
  async loadWindows() {
    return this.get(`store`).query(`gui-widget`, {
      include: `components,components.components`,
      filter: {
        type: `window`
        //visible: true
        //id: ['topWin', 'middleWin', 'bottomWin']
      }
    })
  }

  /**
   *
   */
  didInsertElement() {
    super.didInsertElement(...arguments)

    let canvas = document.getElementById(`render2d`)

    this.engine = AGate.engine
    AGate.createClient(canvas).then(() => {
      this.loadWindows().then(data => {
        let manager = this.getManager()
        manager.setRootWidget(this)
        manager.setMouseSprite(`cursor`)

        this.set(`widgets`, data)
      })
    })
  }

  /**
   *
   * @param event
   */
  mouseMove(event) {
    //this.getManager().onMouseMove(event);
  }
}

export default GameRender
