import * as Pixi from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import * as Filters from 'pixi-filters'

// Preserve namespace-style engine imports without mutating ESM exports.
Pixi.TextureSource.defaultOptions.scaleMode = 'nearest'

export default { ...Pixi, Viewport, Filters2: Filters }
