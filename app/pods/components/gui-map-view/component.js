import { setComponentTemplate } from '@ember/component'
import GuiWidget from '../gui-widget'
import L from 'leaflet'
import { ArcanumTileLayer } from '../gui-map-layer/component'
import template from './layout.hbs'

class GuiMapView extends GuiWidget {
  didInsertElement() {
    super.didInsertElement(...arguments)
    const bounds = new L.LatLngBounds(
      L.CRS.Simple.unproject({ x: 0, y: 2000 }),
      L.CRS.Simple.unproject({ x: 2000, y: 0 })
    )
    this.map = L.map(this.element.querySelector('.leaflet-container'), {
      crs: L.CRS.Simple, attributionControl: false,
      maxBounds: bounds, maxBoundsViscosity: 0.5,
      center: [0, 0], zoom: 0
    })
    this.layer = new ArcanumTileLayer('asset://worldmap/SmallMapChunks{i}.bmp', {
      tms: true, bounds, tileSize: L.point(250, 250), noWrap: true,
      minZoom: 0, maxZoom: 10, minNativeZoom: 0, maxNativeZoom: 0,
      updateWhenIdle: false, keepBuffer: 20
    }).addTo(this.map)
  }

  updateWidgetAttrs() {
    super.updateWidgetAttrs(...arguments)
    if (this.map) this.map.invalidateSize()
  }

  willDestroyElement() {
    this.map?.remove()
    super.willDestroyElement(...arguments)
  }
}

export default setComponentTemplate(template, GuiMapView)
