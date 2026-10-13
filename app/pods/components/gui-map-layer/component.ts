import Component, { setComponentTemplate } from '@ember/component'
import L from 'leaflet'
import template from './layout.hbs'

export class ArcanumTileLayer extends L.TileLayer {
  declare _url: string
  getTileUrl({ x, y }: L.Coords) {
    const index = Math.abs(8 + y) * 8 + (x + 1)
    return this._url.replace('{i}', index.toString().padStart(3, '0'))
  }
}

class GuiMapLayer extends Component {
  declare map?: L.Map
  declare url: string
  declare options?: L.TileLayerOptions
  layer?: ArcanumTileLayer
  didInsertElement() : this {
    super.didInsertElement()
    if (this.map) {
      this.layer = new ArcanumTileLayer(this.url, this.options || {})
      this.layer.addTo(this.map)
    }
  
    return this
  }

  willDestroyElement() : this {
    this.layer?.remove()
    super.willDestroyElement()
  
    return this
  }
}

setComponentTemplate(template, GuiMapLayer)
export default GuiMapLayer
