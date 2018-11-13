import Component from '@ember/component'

import { Engine } from 'open-arcanum/agate/shared/Engine'
import { Manager } from 'open-arcanum/agate/client/Gui'

import { classNames, className, attribute } from '@ember-decorators/component'
import { service } from '@ember-decorators/service'


@classNames(`game-render`)
class GameRender extends Component {
  @service
  store

  @attribute
  shouldRender = false

  /**
   *
   */
  constructor() {
    super(...arguments)

    this.get('resizeService').on('didResize', event => {
      this.engine.events.emitUI('window.resize', this.engine.client.getWindowRect())
    })
  }

  /**
   *
   */
  getElement() {
    return this.get('element')
  }

  /**
   *
   * @returns {Manager}
   */
  getManager() {
    return this.engine.client.guiManager
  }

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

    Engine.instance = new Engine()
    this.engine = Engine.instance

    let canvas = document.getElementById(`render2d`)

    this.engine.createClient(canvas).then(() => {
      this.loadWindows().then(data => {
        let manager = this.getManager()
        manager.setRootWidget(this)
        //manager.setMouseSprite(`cursor`)

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
