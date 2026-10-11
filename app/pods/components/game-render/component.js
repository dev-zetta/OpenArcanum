import Component, { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import { action } from '@ember/object'
import { getAGate, getDataStatus } from 'open-arcanum/lib/runtime'
import template from './layout.hbs'

class GameRender extends Component {
  @service store

  classNames = ['game-render']
  widgets = null
  running = false
  starting = false
  error = null

  constructor() {
    super(...arguments)
    this.dataStatus = getDataStatus()
  }

  getElement() { return this.element }
  getManager() { return this.client.guiManager }

  @action
  refreshDataStatus() {
    this.set('dataStatus', getDataStatus())
  }

  @action
  async startGame() {
    if (this.starting || this.running || !this.dataStatus.ready) return
    this.setProperties({ starting: true, error: null })
    try {
      const runtime = getAGate()
      const widgets = await this.store.query('gui-widget', { filter: { type: 'window' } })
      const canvas = this.element.querySelector('canvas')
      this.client = await runtime.createEngine().createClient(canvas)
      if (this.isDestroying || this.isDestroyed) return
      const manager = this.getManager()
      manager.setRootWidget(this)
      manager.setMouseSprite('cursor')
      this.setProperties({ widgets, running: true })
      this.onWindowResize = () => this.client.emitUI('window.resize')
      window.addEventListener('resize', this.onWindowResize)
    } catch (error) {
      if (!this.isDestroying && !this.isDestroyed) this.set('error', error.message)
    } finally {
      if (!this.isDestroying && !this.isDestroyed) this.set('starting', false)
    }
  }

  willDestroyElement() {
    window.removeEventListener('resize', this.onWindowResize)
    super.willDestroyElement(...arguments)
  }
}

export default setComponentTemplate(template, GameRender)
