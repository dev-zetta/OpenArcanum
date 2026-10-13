import type { Sprite } from 'pixi.js'
import { sourcePixels, texturePixel } from './TexturePixels'

export function createAlphaHitArea(sprite: Sprite) {
  return {
    contains(x: number, y: number) {
      const { texture, anchor } = sprite
      const pixel = texturePixel(texture, sourcePixels(texture.source),
        x + anchor.x * texture.orig.width, y + anchor.y * texture.orig.height)
      return !!pixel && pixel[3] !== 0
    }
  }
}
