let PIXI = require(`pixi.js`)
let Viewport = require(`pixi-viewport`)
let Cull = require('pixi-cull')

class ImageBitmapResource extends PIXI.resources.BaseImageResource {
  static test(source) {
    return source instanceof ImageBitmap
  }
}
// Install the new resource type
PIXI.resources.INSTALLED.push(ImageBitmapResource)

PIXI.BaseTexture.getFromCache = (key) => PIXI.utils.BaseTextureCache[key]

PIXI.Texture.getFromCache = (key) => PIXI.utils.TextureCache[key]


PIXI.Viewport = Viewport
PIXI.Cull = Cull

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST

export default PIXI
