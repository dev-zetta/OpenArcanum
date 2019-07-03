// @flow

import PIXI from '../libs/PIXI'
import Math from '../../shared/misc/Math'
import Utils from '../../shared/misc/Utils'

export default class Spritesheet {

  /**
   *
   * @param baseTexture
   * @param data
   */
  constructor(baseTexture, data) {
    /**
     * Reference to ths source texture
     * @type {PIXI.BaseTexture}
     */
    this.baseTexture = baseTexture

    /**
     * A map containing all textures of the sprite sheet.
     * Can be used to create a {@link PIXI.Sprite|Sprite}:
     * ```js
     * new PIXI.Sprite(sheet.textures["image.png"]);
     * ```
     * @member {Object}
     */
    this.textures = {}

    /**
     * Reference to the original JSON data.
     * @type {Object}
     */
    this.data = data

    /**
     * Map of spritesheet frames.
     * @type {Object}
     * @private
     */
    this._frames = this.data.frames

    /**
     * Collection of frame names.
     * @type {string[]}
     * @private
     */
    this._frameKeys = Object.keys(this._frames)
    this.resolution = 1

    this._processFrames()
  }


  get frames() {
    return this._frames
  }

  get totalFrames() {
    return this._frameKeys.length
  }


  _processFrames(initialFrameIndex = 0) {
    let frameIndex = initialFrameIndex

    if (this.resolution !== 1) {
      this.baseTexture.setResolution(this.resolution)
    }

    while (
      /*frameIndex - initialFrameIndex < maxFrames && */ frameIndex <
      this._frameKeys.length
    ) {
      const i = this._frameKeys[frameIndex]
      const data = this._frames[i]
      const rect = data.frame

      if (rect) {
        let frame = null
        let trim = null
        const sourceSize =
          data.trimmed !== false && data.sourceSize
            ? data.sourceSize
            : data.frame

        const orig = new PIXI.Rectangle(
          0,
          0,
          Math.floor(sourceSize.w) / this.resolution,
          Math.floor(sourceSize.h) / this.resolution
        )

        if (data.rotated) {
          frame = new PIXI.Rectangle(
            Math.floor(rect.x) / this.resolution,
            Math.floor(rect.y) / this.resolution,
            Math.floor(rect.h) / this.resolution,
            Math.floor(rect.w) / this.resolution
          )
        } else {
          frame = new PIXI.Rectangle(
            Math.floor(rect.x) / this.resolution,
            Math.floor(rect.y) / this.resolution,
            Math.floor(rect.w) / this.resolution,
            Math.floor(rect.h) / this.resolution
          )
        }

        //  Check to see if the sprite is trimmed
        if (data.trimmed !== false && data.spriteSourceSize) {
          trim = new Rectangle(
            Math.floor(data.spriteSourceSize.x) / this.resolution,
            Math.floor(data.spriteSourceSize.y) / this.resolution,
            Math.floor(rect.w) / this.resolution,
            Math.floor(rect.h) / this.resolution
          )
        }

        let anchor = data.anchor
        if (!anchor && data.center) {
          anchor = {
            x: data.center.x / rect.w,
            y: data.center.y / rect.h
          }
        }

        this.textures[i] = new PIXI.Texture(
          this.baseTexture,
          frame,
          orig,
          trim,
          data.rotated ? 2 : 0,
          anchor
        )

        // lets also add the frame to pixi's global cache for 'from' and 'fromLoader' functions
        PIXI.Texture.addToCache(this.textures[i], i)
      }

      frameIndex++
    }
  }

  /**
   * Parse animations config
   *
   * @private
   */
  _processAnimations() {
    const animations = this.data.animations || {}

    for (const animName in animations) {
      this.animations[animName] = []
      for (let i = 0; i < animations[animName].length; i++) {
        const frameName = animations[animName][i]

        this.animations[animName].push(this.textures[frameName])
      }
    }
  }

  /**
   *
   * @param key
   * @param image
   * @param meta
   * @returns {Spritesheet}
   */
  static newSpritesheet(
    key: string,
    image: ImageBitmap,
    meta: Object
  ): PIXI.Spritesheet {

    let baseTexture = PIXI.BaseTexture.getFromCache(key)
    if (!baseTexture) {
      baseTexture = new PIXI.BaseTexture(image, {})
      baseTexture.cacheId = key
      PIXI.BaseTexture.addToCache(baseTexture, key)
    }

    let sheet = new Spritesheet(baseTexture, meta)

    /*let frames = meta[`frames`]

    for (let key in frames) {
       let frameInfo = frames[key]
       let delta = frameInfo.delta
       let center = frameInfo.center

       let texture = sheet.textures[key]

       //center = this.iso.unprojectAbsolute(center);

       if (center) {
         //texture.centerX = center.x
         //texture.centerY = center.y
       }
     }*/

    return sheet
  }
}
