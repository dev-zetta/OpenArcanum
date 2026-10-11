import Component, { setComponentTemplate } from '@ember/component'
import L from 'leaflet'
import template from './layout.hbs'

export class ArcanumTileLayer extends L.TileLayer {
  getTileUrl({ x, y }) {
    const index = Math.abs(8 + y) * 8 + (x + 1)
    return this._url.replace('{i}', index.toString().padStart(3, '0'))
  }
}

class GuiMapLayer extends Component {
  didInsertElement() {
    super.didInsertElement(...arguments)
    if (this.map) {
      this.layer = new ArcanumTileLayer(this.url, this.options || {})
      this.layer.addTo(this.map)
    }
  }

  willDestroyElement() {
    this.layer?.remove()
    super.willDestroyElement(...arguments)
  }
}

export default setComponentTemplate(template, GuiMapLayer)
