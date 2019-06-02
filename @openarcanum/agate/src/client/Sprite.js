// @flow

import Gfx from '../shared/enums/Gfx'

import Phaser from '../libs/Phaser'
import Math from '../shared/misc/Math'
import type ClientEngine from './ClientEngine';
import IsoSprite from '../libs/phaser-isometric/IsoSprite';

export default class Sprite {

  client: ClientEngine
  totalElapsed: number
  iso: IsoSprite
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

  /**
   *
   * @param client
   */
  constructor(client: ClientEngine) {
    this.client = client
    this.totalElapsed = 0
    this.iso = null
  }

  /**
   *
   * @returns {integer}
   */
  get stageLength(): number {
    return this.iso.texture.frameTotal
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async load(data: Object): Promise<void> {
    //console.log(data)

    let assetLoader = this.client.engine.assetLoader
    let dataPath = AGate.getDataPath(`Gfx/2D`)

    let path = ``
    if (AGate.Utils.isObject(data)) {
      Object.assign(this, data)

      this.frame = AGate.Utils.isUndefined(data.frame) ? 0 : data.frame

      if (!AGate.Utils.isUndefined(data.type)) {
        this.type = Gfx.Types.get(data.type)
      }

      path = assetLoader.buildPath(this)
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
        if (!AGate.Utils.isUndefined(data.stage)) {
          this.currentStage = data.stage
        }

        if (!this.currentStage) {
          this.currentStage = `North`
        }

        break
    }

    let spritePath = `${dataPath}/${this.path}`
    //console.log(`Loading: ${spritePath}`);

    let meta = await assetLoader.loadJsonFile(`${spritePath}/Meta.json`)
    if (!meta) {
      console.log(`Unable to load sprite: ${`${spritePath}/Meta.json`}`)
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

    let stageDirs = await assetLoader.findDirs(variantPath)

    let promises = []

    for (let [key, value] of stageDirs) {
      let stageName = key // AGate.Utils.getLastDir(dir);
      let stagePath = `${variantPath}/${stageName}`
      let assetKey = `${keyPrefix}/${stageName}`

      let promise = this.client.scene.loadAsset(assetKey, `atlas`, {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      })

      promises.push(promise)

      this.stages.push(stageName)
    }

    await Promise.all(promises)
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
    let sprite = this.iso
    let texture = sprite.texture

    // Generate key name
    let key = texture.firstFrame
    key = key.substring(0, key.lastIndexOf(`/`))
    key = `${key}/${index}`

    //sprite.frame = sprite.texture.frames[key];

    sprite.setFrame(key)

    sprite.displayOriginX = sprite.frame.centerX
    sprite.displayOriginY = sprite.frame.centerY

    this.frame = index
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
    let texture = sprite.texture

    // Generate key name
    let key = texture.key
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
   *
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
      Math.round(this.totalElapsed * frameTime) %
      (sprite.texture.frameTotal - 1)

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
        mode = Phaser.BlendModes.ADD
        break
      case `BlendMul`:
        mode = Phaser.BlendModes.MULTIPLY
        break
      default:
        return
    }
    this.iso.setBlendMode(mode)
  }

  /**
   *
   * @param color
   */
  setTint(color: string) {
    this.iso.setTint(color)
  }

  /**
   *
   * @returns {*}
   */
  get isoPosition(): Object {
    return this.iso.isoPosition
  }

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
      sprite.setTexture(key, frame)
    }
  }

  setPipeline(name: string) {
    let sprite = this.iso
    sprite.setPipeline(name);
  }

  /**
   *
   * @param x
   * @param y
   * @param z
   * @param offset
   */
  addToScene(target: Object, x: number, y: number, z: number = 0, offset: Object = null) {
    let {key, frame} = this.makeTextureInfo()

    //if (this.type == GfxTypes.Tile)
    //  console.log(offset);

    let isoSprite = new IsoSprite(target.scene, x, y, z, key, frame, offset)
    target.add(isoSprite, true)

    isoSprite.data = this
    this.iso = isoSprite
    this.offset = offset

    switch (this.type) {
      case Gfx.Types.Wall:
      case Gfx.Types.Portal:
        isoSprite.alpha = 0.7
        break
    }

    isoSprite.setInteractive()

    if (this.flipped && this.type !== Gfx.Types.Facade) {
      //this.sprite.originX = 0.5;
      isoSprite.scaleX *= -1

      //this.sprite.flipX = true;
      isoSprite.resetIsoBounds()
    }

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

    //if (sprite.type == Gfx.Types.Tile)
    //isoSprite.setPipeline('Light2D');
  }




  //  Canvas and WebGL:

  // NORMAL
  // ADD
  // MULTIPLY
  // SCREEN

  //  Canvas only:

  // OVERLAY
  // DARKEN
  // LIGHTEN
  // COLOR_DODGE
  // COLOR_BURN
  // HARD_LIGHT
  // SOFT_LIGHT
  // DIFFERENCE
  // EXCLUSION
  // HUE
  // SATURATION
  // COLOR
  // LUMINOSITY

  // image.setBlendMode(Phaser.BlendModes.OVERLAY);
}
