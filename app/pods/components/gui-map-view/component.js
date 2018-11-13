/* global L */
import GuiWidget from '../gui-widget'
import { action, computed } from '@ember-decorators/object'

class GuiMapView extends GuiWidget {
  default = {
    //sprite: 'Worldmap'
  }

  crs = L.CRS.Simple
  lat = 0
  lng = 0
  zoom = 0

  emberConfLocation = [0, 0]
  hotel = [2000, 2000]

  @computed
  get tileSize(){
    return L.point(250, 250)
  }

  @computed
  get bounds() {
    let w = 2000
    let h = 2000

    let southWest = L.CRS.Simple.unproject({ x: 0, y: h })
    let northEast = L.CRS.Simple.unproject({ x: w, y: 0})

    let bounds = new L.LatLngBounds(southWest, northEast)
    return bounds
  }



  /**
   *
   */
  didInsertElement() {
    super.didInsertElement()
  }

  /**
   *
   */
  updateWidgetAttrs() {
    super.updateWidgetAttrs()

    let element = this.get(`element`)
    if (element) {
      let map = element.querySelector(`.leaflet-container`)

      let size = this.getSize()
      map.style.width = `${size.width}px`
      map.style.height = `${size.height}px`
    }
  }

  @action
  onLoad(e) {
    this.map = e.target
    console.error(this.map)
  }
}

export default GuiMapView
