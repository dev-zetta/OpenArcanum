import Component, { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import { action, computed } from '@ember/object'
import { getAGate, getDataStatus, loadGuiStylesheet } from 'open-arcanum/lib/runtime'
import template from './layout.hbs'

class GameRender extends Component {
  @service store

  classNames = ['game-render']
  attributeBindings = ['runtimeState:data-runtime-state']

  @computed('running', 'starting', 'error')
  get runtimeState() {
    return this.starting ? 'starting' : this.error ? 'error' : this.running ? 'running' : 'ready'
  }
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
      await loadGuiStylesheet(runtime.getAppUrl('gui/gui-images.css'))
      this.gameEngine = runtime.createEngine()
      this.client = await this.gameEngine.createClient(canvas, {
        standaloneMode: true,
        mapId: this.dataStatus.mapId
      })
      if (this.isDestroying || this.isDestroyed) {
        this.client.stop()
        return
      }
      this.onRuntimeError = error => {
        if (!this.isDestroying && !this.isDestroyed) this.set('error', error.message)
      }
      this.client.events.on('Game:Error', this.onRuntimeError)
      const manager = this.getManager()
      manager.setRootWidget(this)
      manager.setMouseSprite('cursor')
      this.setProperties({ widgets, running: true })
      this.onWindowResize = () => this.client.emitUI('window.resize')
      window.addEventListener('resize', this.onWindowResize)
    } catch (error) {
      this.gameEngine?.client?.stop()
      console.error('Game startup failed', error)
      if (!this.isDestroying && !this.isDestroyed) this.set('error', error.message)
    } finally {
      if (!this.isDestroying && !this.isDestroyed) this.set('starting', false)
    }
  }

  willDestroyElement() {
    window.removeEventListener('resize', this.onWindowResize)
    const client = this.client || this.gameEngine?.client
    if (client) {
      if (this.onRuntimeError) client.events.off('Game:Error', this.onRuntimeError)
      client.stop()
    }
    super.willDestroyElement(...arguments)
  }
}

export default setComponentTemplate(template, GameRender)
