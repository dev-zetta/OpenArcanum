// @flow

import Gfx from '../shared/enums/Gfx'
import Math from '../shared/misc/Math'
import IsoSprite from './isometric/Sprite'
import Utils from '../shared/misc/Utils'
import GfxPathBuilder from '../shared/assets/GfxPathBuilder'
import type Scene from './Scene'
import Spritesheet from './isometric/Spritesheet'

export default class Sprite {
  scene: Scene
  totalElapsed: number
  iso: Sprite
  flipped: boolean
  type: string
  frame: number
  path: string
  currentStage: string
  selectedVariant: number
  frameRate: number
  triggerFrame: number
  animated: boolean
  variants: Array<Object>
  stages: Array<Object>
  data: any
  offset: Object
  iso: IsoSprite

  /**
   *
   * @param scene
   */
  constructor(scene: Scene) {
    this.scene = scene
    this.totalElapsed = 0
  }

  /**
   *
   * @returns {integer}
   */
  /* get stageLength(): number {
    return this.texture.frameTotal
  }*/

  get assetLoader() {
    return this.scene.assetLoader
  }

  async loadSpritesheet(key, options: Object) {
    let descriptor = await this.scene.loadAsset(key, `atlas`, options)

    if (descriptor.spritesheet) {
      return descriptor.spritesheet
    }

    let spritesheet = Spritesheet.newSpritesheet(
      descriptor.key,
      descriptor.image,
      descriptor.meta
    )

    descriptor.spritesheet = spritesheet

    delete descriptor.image
    delete descriptor.meta

    return spritesheet
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async load(data: Object): Promise<void> {
    let dataPath = AGate.getDataPath(`Gfx/2D`)

    let path = ``
    if (Utils.isObject(data)) {
      Object.assign(this, data)

      if (Utils.isUndefined(data.type)) {
        //lll('Loading sprite data for undefined sprite type')
        return
      }

      this.frame = Utils.isUndefined(data.frame) ? 0 : data.frame

      /*if (!Utils.isUndefined(data.type)) {
        this.type = Gfx.Types.get(data.type)
      }*/

      path = GfxPathBuilder.build(this)
    } else {
      path = data
    }

    this.path = path
    this.selectedVariant = 0

    switch (this.type) {
      case Gfx.Types.Tile:
        this.currentStage = `North`
        return
      default:
        if (!Utils.isUndefined(data.stage)) {
          this.currentStage = data.stage
        }

        if (!this.currentStage) {
          this.currentStage = `North`
        }

        break
    }

    let spritePath = `${dataPath}/${this.path}`
    //console.log(`Loading: ${spritePath}`);

    let meta = await this.assetLoader.loadJsonFile(`${spritePath}/Meta.json`)
    if (!meta) {
      lll(`Unable to load sprite: ${`${spritePath}/Meta.json`}`)
      return
    }

    this.frameRate = meta.frameRate
    this.triggerFrame = meta.triggerFrame
    this.animated = meta.animated

    //Object.assign(this, meta);

    this.variants = []
    this.stages = []

    let variantPath = `${spritePath}/${this.selectedVariant}`
    let keyPrefix = `${this.path}/${this.selectedVariant}`

    let stageDirs = await this.assetLoader.findDirs(variantPath)

    let promises = []

    for (let [key, value] of stageDirs) {
      let stageName = key // AGate.Utils.getLastDir(dir);
      let stagePath = `${variantPath}/${stageName}`
      let assetKey = `${keyPrefix}/${stageName}`

      let promise = this.loadSpritesheet(assetKey, {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      })

      promises.push(promise)

      this.stages.push(stageName)
    }

    return Promise.all(promises)
  }

  /**
   *
   * @returns {{key: string, frame: string}}
   */
  makeTextureInfo(): Object {
    let frame, key
    let currentPath = `${this.path}/${this.selectedVariant}`

    switch (this.type) {
      case Gfx.Types.Tile:
        key = `tiles`
        frame = `${currentPath}/${this.currentStage}/Sprite.gif`
        break
      case Gfx.Types.Wall:
        key = `${currentPath}/North`
        frame = `${key}/${this.frame}`
        break
      case Gfx.Types.Portal:
        key = `${currentPath}/North`
        frame = `${key}/0`
        //this.animated = true;
        break
      default:
        key = `${currentPath}/${this.currentStage}`
        frame = `${key}/${this.frame}`
        break
    }

    return { key, frame }
  }

  /**
   *
   * @param data
   */
  setData(data: any) {
    this.data = data
  }

  /**
   *
   * @param index
   */
  setFrame(index: number) {
    // TODO
    return
    let sprite = this.iso

    let texture = sprite.texture

    // Generate key name
    let key = this.getCacheId()
    key = key.substring(0, key.lastIndexOf(`/`))
    key = `${key}/${index}`

    sprite.texture = sprite.textures[key]

    sprite.displayOriginX = sprite.frame.centerX
    sprite.displayOriginY = sprite.frame.centerY

    this.frame = index
  }

  getCacheId() {
    let sprite = this.iso
    let texture = sprite.texture

    //console.log(texture)

    return texture.textureCacheIds[0]
  }

  /**
   *
   * @param stage
   */
  setStage(stage: string) {
    if (stage === this.currentStage) {
      return
    }

    //console.log(`Changing to stage ${stage}`)

    let sprite = this.iso

    // Generate key name
    let key = this.getCacheId()
    if (!key)
      return


    key = key.substring(0, key.lastIndexOf(`/`))
    key = `${key}/${stage}`

    sprite.setTexture(key)


    this.currentStage = stage
  }

  /**
   *
   * @returns {boolean}
   */
  isValid(): boolean {
    return !!this.iso
  }

  /**
   * move sprite, pixel based
   * @param x
   * @param y
   */
  move(x: number, y: number) {
    //let delta = (elapsed % 1001) / 1000;
    let sprite = this.iso

    //console.log(x * delta, y * delta)
    sprite.isoMove(x, y)
    sprite.postUpdate()
  }

  /**
   *
   * @param elapsed
   * @param speed
   */
  update(elapsed: number, speed: number = 1.0) {
    this.totalElapsed += elapsed

    let sprite = this.iso
    if (!sprite) {
      return
    }

    //let elapsed = (totalElapsed % 1000);

    let frameTime = (this.frameRate / 1000) * speed
    let frameIndex =
      Math.round(this.totalElapsed * frameTime) % (sprite.totalFrames - 1)

    if (!isNaN(frameIndex)) {
      this.setFrame(frameIndex)
    }
  }

  /**
   *
   * @param mode
   */
  setBlendMode(mode: string) {
    switch (mode) {
      case `BlendAdd`:
        //mode = Phaser.BlendModes.ADD
        break
      case `BlendMul`:
        //mode = Phaser.BlendModes.MULTIPLY
        break
      default:
        return
    }
    //this.iso.setBlendMode(mode)
  }

  /**
   *
   * @param color
   */
  setTint(color: string) {}

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async change(data: Object) {
    await this.load(data)

    this.frame = 0
    this.totalElapsed = 0

    let { key, frame } = this.makeTextureInfo()

    //console.log(`Changing to: ${key} - ${frame}`)
    let sprite = this.iso
    if (sprite) {
      //const spritesheet = this.getSpritesheetByKey(key)
      //sprite.setTexture(key, frame)
    }
  }

  /**
   *
   * @param name
   */
  setPipeline(name: string) {
    let sprite = this.iso
    sprite.setPipeline(name)
  }

  getSpritesheetByKey(key) {
    let descriptor = this.assetLoader.getCachedAsset(key)
    if (!descriptor) {
      lll(`Sprite not in cache!`, key)
      return
    }

    if (!descriptor.spritesheet) {
      lll(`Spritesheet missing!`, descriptor)
      return
    }

    return descriptor.spritesheet
  }

  /**
   *
   * @param target
   * @param x
   * @param y
   * @param z
   * @param offset
   */
  addToScene(
    target: Object,
    x: number,
    y: number,
    z: number = 0,
    offset: Object = null
  ) {
    let { key, frame } = this.makeTextureInfo()

    //if (this.type == GfxTypes.Tile)
    //  console.log(offset);


    const spritesheet = this.getSpritesheetByKey(key)
    if (!spritesheet) {
      return
    }


    if (Utils.isArray(offset)) {
      offset = { x: offset[0], y: offset[1] }
    }

    let sprite = new IsoSprite(spritesheet, frame, this.scene.isometric)
    sprite.addToContainer(target, x, y, z, offset)

    this.offset = offset

    switch (this.type) {
      case Gfx.Types.Wall:
      case Gfx.Types.Portal:
        sprite.alpha = 0.7
        break
    }

    sprite.interactive = true

    if (this.flipped && this.type !== Gfx.Types.Facade) {
      //this.sprite.originX = 0.5;
      sprite.scale.x *= -1

      //this.sprite.flipX = true;
      sprite.resetIsoBounds()
    }

    this.iso = sprite
    sprite.data = this

    /*if (this.animated) {
      for (let stageIndex = 0; stageIndex < this.stages.length; stageIndex++) {
        let stageName = this.stages[stageIndex];
        let stagePath = `${this.path}/${this.selectedVariant}/${stageName}`;

        // create animation
        let frames = target.scene.anims.generateFrameNames(stagePath,
          {prefix: `${stagePath}/`, end: this.stageLength - 1});

        target.scene.anims.create({
            key: stagePath,
            frames: frames,
            frameRate: this.frameRate,
            repeat: -1,

            onUpdate: (sprite, animation, params) => {
              sprite.displayOriginX = sprite.frame.centerX;
              sprite.displayOriginY = sprite.frame.centerY;
            }
        });

        // load animation
        this.sprite.anims.play(stagePath);
      }
    }*/
  }



}
