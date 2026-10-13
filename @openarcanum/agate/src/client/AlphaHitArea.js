import { sourcePixels, texturePixel } from './TexturePixels'

export function createAlphaHitArea(sprite) {
  return {
    contains(x, y) {
      const { texture, anchor } = sprite
      const pixel = texturePixel(texture, sourcePixels(texture.source),
        x + anchor.x * texture.orig.width, y + anchor.y * texture.orig.height)
      return !!pixel && pixel[3] !== 0
    }
  }
}
