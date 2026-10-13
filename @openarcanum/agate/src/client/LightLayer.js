import PIXI from './libs/PIXI'
import { sourcePixels, texturePixel } from './TexturePixels'

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vLightCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uLightMatrix;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  gl_Position = vec4(
    position.x * 2.0 / uOutputTexture.x - 1.0,
    position.y * 2.0 * uOutputTexture.z / uOutputTexture.y - uOutputTexture.z,
    0.0, 1.0);
  vTextureCoord = aPosition * uOutputFrame.zw * uInputSize.zw;
  vLightCoord = (uLightMatrix * vec3(vTextureCoord, 1.0)).xy;
}`

const fragment = `
in vec2 vTextureCoord;
in vec2 vLightCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLightMap;
void main() {
  vec4 artwork = texture(uTexture, vTextureCoord);
  vec3 illumination = texture(uLightMap, clamp(vLightCoord, 0.0, 1.0)).rgb;
  finalColor = vec4(artwork.rgb * illumination, artwork.a);
}`

export function lightRGB(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(channel =>
    !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new Error('Lighting RGB must contain three original 0–255 color bytes')
  }
  return value.slice()
}

function point(value, name, fallback = null) {
  if (value === undefined || value === null) {
    if (fallback) return fallback
    throw new Error(`Missing light ${name}`)
  }
  const x = Array.isArray(value) ? value[0] : value.x
  const y = Array.isArray(value) ? value[1] : value.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Invalid light ${name}`)
  }
  return { x, y }
}

/**
 * Converted locations already reverse the original SEC x/y axes. Match the
 * current object ground origin, not the floor's hotspot correction. CE uses
 * this same point plus a common 20px camera-origin translation for all objects.
 * Offsets and hotspots are screen pixels, not additional world coordinates.
 */
export function lightWorldPosition(light) {
  const location = point(light.location, 'location')
  const offset = point(light.offset, 'offset', { x: 0, y: 0 })
  return {
    x: 40 * (location.x - location.y) + offset.x,
    y: 20 * (location.x + location.y) + offset.y
  }
}

function multiplyTint(tint, rgb) {
  return (Math.round(((tint >> 16) & 255) * rgb[0] / 255) << 16) |
    (Math.round(((tint >> 8) & 255) * rgb[1] / 255) << 8) |
    Math.round((tint & 255) * rgb[2] / 255)
}

class LightMultiplyFilter extends PIXI.Filter {
  constructor(sprite) {
    super({
      glProgram: PIXI.GlProgram.from({ vertex, fragment, name: 'arcanum-light-map' }),
      resources: {
        lightUniforms: {
          uLightMatrix: { value: new PIXI.Matrix(), type: 'mat3x3<f32>' }
        },
        uLightMap: sprite.texture.source,
        uLightSampler: sprite.texture.source.style
      }
    })
    this.lightMapSprite = sprite
  }

  apply(manager, input, output, clear) {
    // Use Pixi's filter-space mapping, also used by its DisplacementFilter.
    // This handles cropped target bounds and other filters without assuming
    // the filter input texture fills the entire screen.
    manager.calculateSpriteMatrix(
      this.resources.lightUniforms.uniforms.uLightMatrix, this.lightMapSprite)
    manager.applyFilter(this, input, output, clear)
  }
}

/**
 * First static lighting pass for one homogeneous indoor/outdoor map group.
 * Original Light ART supplies the shape and falloff. There is no
 * guessed radius/intensity: lightmap = ambient + sum(mask * original RGB),
 * saturated at 255, then artwork is multiplied by that lightmap.
 *
 * Call update() after viewport.update(dt), before rendering the scene. The
 * mask tree follows the viewport's complete global transform, while the
 * lightmap and filter sampling stay in screen coordinates. Attach this only
 * to map art; roofs with another ambient and UI belong outside the target.
 *
 * Register ordinary objects with addSampledTarget(): one original mask color
 * at the object's ground point tints its entire artwork, independent of height
 * and animation frame. Floors and the current wall approximation use addTarget().
 * DontLight and blend effects remain outside both kinds of target. No objects
 * move out of their shared depth order.
 *
 * This does not reproduce CE's 40x20 sample grid, wall vertex gradients,
 * shadows, animated masks, dark lights or ambient-following flags. Only
 * zero-flag, static original masks are supported and counted as rendered.
 */
export default class LightLayer {
  constructor({ renderer, viewport, target, ambient }) {
    if (renderer.type !== PIXI.RendererType.WEBGL) {
      throw new Error('Static map lighting currently requires the WebGL renderer')
    }
    const initialAmbient = lightRGB(ambient)
    this.renderer = renderer
    this.viewport = viewport
    this.target = target
    this.targets = new Set()
    this.sampledTargets = new Map()
    this.maskPixels = new Map()
    this.revision = 0
    this.skipped = []
    this.destroyed = false
    this.lightScene = new PIXI.Container()
    this.worldLights = new PIXI.Container()
    this.background = new PIXI.Sprite(PIXI.Texture.WHITE)
    this.background.width = 1
    this.background.height = 1
    this.lightScene.addChild(this.background, this.worldLights)
    this.texture = PIXI.RenderTexture.create({ width: 1, height: 1, resolution: 1 })
    // This detached sprite is a screen-space texture reference for the filter,
    // not a luminous overlay that would change transparent map pixels.
    this.lightMapSprite = new PIXI.Sprite(this.texture)
    this.filter = new LightMultiplyFilter(this.lightMapSprite)
    this.addTarget(target)
    this.setAmbient(initialAmbient)
  }

  /**
   * Share one lightmap/filter between floor groups and ordinary object sprites
   * without moving objects out of their original depth-sorted container. A
   * registered target must not contain another registered target, or pixels
   * would be multiplied twice. The caller selects the original lighting flags.
   */
  addTarget(target) {
    if (this.destroyed) throw new Error('Cannot register a target on a destroyed LightLayer')
    if (!target || target.destroyed) throw new Error('Cannot light a missing or destroyed target')
    if (this.sampledTargets?.has(target)) throw new Error('A sampled object cannot also receive the floor light filter')
    if (!this.targets.has(target)) {
      target.filters = [...(target.filters || []), this.filter]
      this.targets.add(target)
    }
    return target
  }

  addSampledTarget(target, getWorldPoint) {
    if (this.destroyed) throw new Error('Cannot register a target on a destroyed LightLayer')
    if (!target || target.destroyed) throw new Error('Cannot light a missing or destroyed target')
    if (typeof getWorldPoint !== 'function') throw new Error('Object lighting requires a ground point callback')
    if (this.targets.has(target)) throw new Error('A filtered target cannot also receive sampled object lighting')
    const existing = this.sampledTargets.get(target)
    this.sampledTargets.set(target, {
      originalTint: existing ? existing.originalTint : target.tint,
      getWorldPoint,
      previous: null
    })
    return target
  }

  sampleColor(worldPoint) {
    const position = point(worldPoint, 'sample position')
    const rgb = this.ambient.slice()
    for (const [sprite, pixels] of this.maskPixels) {
      const pixel = texturePixel(sprite.texture, pixels,
        position.x - sprite.x + sprite.anchor.x * sprite.texture.orig.width,
        position.y - sprite.y + sprite.anchor.y * sprite.texture.orig.height)
      if (!pixel || !pixel[3]) continue
      const tint = sprite.tint
      const color = [(tint >> 16) & 255, (tint >> 8) & 255, tint & 255]
      for (let channel = 0; channel < 3; channel++) {
        // Original palette multiplication truncates each mask contribution
        // before adding lights. Rounding only the final sum makes overlaps
        // brighter than their original integer RGB samples.
        rgb[channel] += Math.floor(pixel[channel] * pixel[3] * color[channel] / (255 * 255))
      }
    }
    return rgb.map(channel => Math.min(255, channel))
  }

  updateSampledTargets() {
    for (const [target, entry] of this.sampledTargets) {
      if (target.destroyed) {
        this.sampledTargets.delete(target)
        continue
      }
      const position = point(entry.getWorldPoint(), 'sample position')
      const previous = entry.previous
      if (!previous || previous.x !== position.x || previous.y !== position.y ||
          previous.revision !== this.revision) {
        target.tint = multiplyTint(entry.originalTint, this.sampleColor(position))
        entry.previous = { ...position, revision: this.revision }
      }
    }
  }

  setAmbient(ambient) {
    this.ambient = lightRGB(ambient)
    const [r, g, b] = this.ambient
    this.background.tint = (r << 16) | (g << 8) | b
    this.revision++
  }

  skip(light, reason) {
    this.skipped.push({
      reason,
      flags: Number.isInteger(light.flags) ? light.flags : null,
      name: light.resource && light.resource.name || null
    })
    return null
  }

  addLight(light, texture, center) {
    if (this.destroyed) throw new Error('Cannot add a light to a destroyed LightLayer')
    const flags = light.flags === undefined ? 0 : light.flags
    if (!Number.isInteger(flags) || flags !== 0) {
      return this.skip(light, 'Unsupported static light flags')
    }
    if (!texture || !texture.orig || texture === PIXI.Texture.EMPTY) {
      return this.skip(light, 'Missing original light mask texture')
    }
    if (!Array.isArray(light.rgb)) {
      return this.skip(light, 'Missing recovered original RGB bytes')
    }
    const rgb = lightRGB(light.rgb)
    const position = lightWorldPosition(light)
    if (!center && !texture.defaultAnchor) {
      return this.skip(light, 'Missing original light mask hotspot')
    }
    const hotspot = center
      ? point(center, 'hotspot')
      : {
          x: texture.defaultAnchor.x * texture.orig.width,
          y: texture.defaultAnchor.y * texture.orig.height
        }
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(hotspot.x / texture.orig.width, hotspot.y / texture.orig.height)
    sprite.position.set(position.x, position.y)
    sprite.tint = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    sprite.blendMode = 'add'
    sprite.eventMode = 'none'
    this.maskPixels.set(sprite, sourcePixels(texture.source))
    this.worldLights.addChild(sprite)
    this.revision++
    return sprite
  }

  update() {
    if (this.destroyed) return
    this.updateSampledTargets()
    const width = Math.max(1, Math.ceil(this.renderer.screen.width))
    const height = Math.max(1, Math.ceil(this.renderer.screen.height))
    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.resize(width, height)
      this.background.width = width
      this.background.height = height
    }
    // getGlobalTransform refreshes the matrix after camera movement, avoiding
    // stale worldTransform values from the previous main render.
    this.worldLights.setFromMatrix(this.viewport.getGlobalTransform())
    this.renderer.render({ container: this.lightScene, target: this.texture, clear: true })
  }

  get diagnostics() {
    return {
      rendered: this.worldLights.children.length,
      targets: this.targets.size + this.sampledTargets.size,
      filteredTargets: this.targets.size,
      sampledTargets: this.sampledTargets.size,
      skipped: this.skipped.length,
      skippedReasons: this.skipped.slice(),
      ambient: this.ambient.slice(),
      model: 'static-original-mask-multiply',
      approximation: 'Full-resolution floor masks; wall gradients, vertex sampling and shadows are not implemented'
    }
  }

  clear() {
    for (const sprite of this.worldLights.removeChildren()) sprite.destroy()
    this.maskPixels.clear()
    this.skipped.length = 0
    this.revision++
  }

  destroy() {
    if (this.destroyed) return
    for (const target of this.targets) {
      if (!target.destroyed) {
        target.filters = (target.filters || []).filter(filter => filter !== this.filter)
      }
    }
    this.targets.clear()
    for (const [target, { originalTint }] of this.sampledTargets) {
      if (!target.destroyed) target.tint = originalTint
    }
    this.sampledTargets.clear()
    this.clear()
    this.filter.destroy()
    this.lightMapSprite.destroy()
    this.lightScene.destroy({ children: true })
    this.texture.destroy(true)
    this.destroyed = true
  }
}
