import type { Texture, TextureSource } from 'pixi.js'
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }
// Decoded atlas pixels are shared by CPU hit tests and static light sampling.
// Reading the source image avoids GPU readbacks and keeps samples in ART pixels.
const sources = new WeakMap<TextureSource, Pixels>()

export function sourcePixels(source: TextureSource): Pixels {
  let pixels = sources.get(source)
  if (pixels) return pixels
  const image = source.resource
  const width = image?.width
  const height = image?.height
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Pixel sampling requires a decoded image texture')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Unable to read decoded texture pixels')
  context.drawImage(image, 0, 0)
  pixels = { data: context.getImageData(0, 0, width, height).data, width, height }
  sources.set(source, pixels)
  return pixels
}

export function texturePixel(texture: Texture, pixels: Pixels, x: number, y: number) {
  if (texture.rotate) throw new Error('Rotated atlas pixel sampling is unsupported')
  const frame = texture.frame
  const px = Math.floor(x - (texture.trim?.x || 0))
  const py = Math.floor(y - (texture.trim?.y || 0))
  if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return null
  const index = ((frame.y + py) * pixels.width + frame.x + px) * 4
  return pixels.data.subarray(index, index + 4)
}
