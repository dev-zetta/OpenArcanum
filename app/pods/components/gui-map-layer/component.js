/* global L */
import GuiWidget from '../gui-widget'
import { action, computed } from '@ember-decorators/object'

import leaflet from 'ember-leaflet'

// https://stackoverflow.com/questions/43826338/leaflet-custom-url-custom-tiles

class GuiMapLayer extends leaflet.TileLayer {
  constructor() {
    super(...arguments)

    this.RawLayer = L.TileLayer.extend({
      getTileUrl(coords) {
        const {x, y} = coords
        //if (x < 0 || x > 8 || y > -1 || y < -8) return ``

        let invertedY = Math.abs(8 + y)

        let i = invertedY * 8 + (x + 1)
        let url = this._url.replace(`{i}`, i.toString().padStart(3, `0`))
        //console.error(coords, invertedY, i, this)

        return url
      }
    })
  }

  /**
   *
   */
  didInsertElement() {
    super.didInsertElement(...arguments)
  }

  createLayer() {
    return new this.RawLayer(
      ...this.get(`requiredOptions`),
      this.get(`options`)
    )
  }
}

export default GuiMapLayer
