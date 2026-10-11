// @flow

import PIXI from '../libs/PIXI'
import Math from '../../shared/misc/Math'
import Utils from '../../shared/misc/Utils'

export default class Spritesheet {

  baseTexture: PIXI.TextureSource
  textures: Object
  data: Object
  _frames: Object
  _frameKeys: Array<string>
  resolution: number

  /**
   *
   * @param baseTexture
   * @param data
   */
  constructor(baseTexture, data) {
    /**
     * Reference to ths source texture
     * @type {PIXI.TextureSource}
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
    this._frameKeys = []
    this.resolution = 1

    this._processFrames()
  }


  get frames() {
    return this._frames
  }

  get totalFrames() {
    return this._frameKeys.length
  }

  getFrameKey(index: number): string {
    if (index >= this._frameKeys.length) {
      lle('Accessing unknown key', index)
      return null
    }


    return this._frameKeys[index]
  }

  getTextureByIndex(index: number): ?Object {
    let texture = this.textures[this.getFrameKey(index)]
    if (!texture) {
      //lle('Nonexisting texture', index, this)
      return null
    }

    return texture
  }

  _processFrames() {

    if (this.resolution !== 1) {
      this.baseTexture.resolution = this.resolution
    }

    for (let key in this._frames) {
      let i = key.substr(key.lastIndexOf('/') + 1)
      this._frameKeys[Number(i)] = key


      const data = this._frames[key]
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
          trim = new PIXI.Rectangle(
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

        this.textures[key] = new PIXI.Texture({
          source: this.baseTexture,
          frame,
          orig,
          trim,
          rotate: data.rotated ? 2 : 0,
          defaultAnchor: anchor
        })

        // lets also add the frame to pixi's global cache for 'from' and 'fromLoader' functions
        PIXI.Cache.set(key, this.textures[key])
      }
    }

    //this._frameKeys.sort()
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

    const sourceKey = `agate:source:${key}`
    let baseTexture = PIXI.Cache.has(sourceKey) ? PIXI.Cache.get(sourceKey) : null
    if (!baseTexture) {
      baseTexture = new PIXI.ImageSource({ resource: image, scaleMode: 'nearest' })
      PIXI.Cache.set(sourceKey, baseTexture)
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
