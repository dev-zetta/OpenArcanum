import * as Pixi from 'pixi.js'
// The Node-targeted engine bundle otherwise selects viewport's CommonJS entry,
// creating a second Pixi Container class without the renderer's event mixins.
import { Viewport } from 'pixi-viewport/dist/pixi_viewport.js'
import * as Filters from 'pixi-filters'

// Preserve namespace-style engine imports without mutating ESM exports.
Pixi.TextureSource.defaultOptions.scaleMode = 'nearest'

export default { ...Pixi, Viewport, Filters2: Filters }
