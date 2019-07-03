// @flow

import Gfx from '../shared/enums/Gfx'
import Math from '../shared/misc/Math'
import IsoSprite from './isometric/Sprite'
import Utils from '../shared/misc/Utils'
import GfxPathBuilder from '../shared/assets/GfxPathBuilder'
import type Scene from './Scene'
import Spritesheet from './isometric/Spritesheet'
import Vec2 from '../shared/misc/Vec2'

export type Meta = {}

export default class Sprite {
  scene: Scene
  totalElapsed: number
  flipped: boolean
  type: string
  stageKey: string // stage key
  frame: number
  totalFrames: number
  frameKey: string
  frameRate: number
  triggerFrame: number


  path: string
  stage: string
  variant: number

  animated: boolean
  variants: Array<string>
  stages: Array<string>
  data: any
  offset: Vec2
  iso: IsoSprite

  //meta: Meta

  /**
   *
   * @param scene
   */
  constructor(scene: Scene) {
    this.scene = scene
    this.totalElapsed = 0
    this.totalFrames = 0
    this.animated = false

    let sprite = new IsoSprite(this.scene.isometric)
    sprite.data = this

    this.iso = sprite

    this.offset = new Vec2()
  }

  /**
   *
   * @returns {integer}
   */
  /* get stageLength(): number {
    return this.texture.frameTotal
  }*/

  /**
   *
   * @returns {AssetLoader}
   */
  get assetLoader() {
    return this.scene.assetLoader
  }

  /**
   *
   * @param key
   * @param options
   * @returns {Promise<Spritesheet>}
   */
  async loadSpritesheet(key, options: Object) {
    const spritesheet = this.getSpritesheetByKey(key)
    if (spritesheet) {
      return spritesheet
    }

    let descriptor = await this.scene.loadAsset(key, `atlas`, options)

    if (descriptor.spritesheet) {
      lll(`Huh?`)
      return descriptor.spritesheet
    }

    descriptor = Sprite.createSpritesheet(descriptor)
    return descriptor.spritesheet
  }

  static createSpritesheet(descriptor) {
    let spritesheet = Spritesheet.newSpritesheet(
      descriptor.key,
      descriptor.image,
      descriptor.meta
    )

    descriptor.spritesheet = spritesheet

    delete descriptor.image
    delete descriptor.meta

    return descriptor
  }

  get type() {
    return Gfx.Types.get(this.meta.type)
  }

  get stage() {
    return this.meta.stage
  }

  set stage(stage) {
    this.meta.stage = stage
  }

  get frame() {
    return this.meta.frame
  }

  set frame(frame) {
    this.meta.frame = frame
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async load(source: Object): Promise<void> {
    let dataPath = AGate.getDataPath(`Gfx/2D`)

    let path = ``
    if (Utils.isObject(source)) {
      this.meta = source

      if (Utils.isUndefined(source.type)) {
        //lll('Loading sprite data for undefined sprite type')
        return
      }

      this.frame = Utils.isUndefined(source.frame) ? 0 : source.frame

      /*if (!Utils.isUndefined(data.type)) {
        this.type = Gfx.Types.get(data.type)
      }*/

      path = GfxPathBuilder.build(this.meta)
    } else {
      path = source
    }

    this.path = path // TODO: Prevents loading other files
    this.variant = 0

    let spritePath = `${dataPath}/${this.path}`
    //console.log(`Loading: ${spritePath}`);

    let meta = await this.assetLoader.loadJsonFile(`${spritePath}/Meta.json`)
    if (!meta) {
      lll(`Unable to load sprite: ${`${spritePath}/Meta.json`}`)
      return
    }

    if (this.type === Gfx.Types.Tile) {
      this.stage = `North`
    }

    if (Utils.isUndefined(this.stage)) {
      this.stage = `North`
    }

    let { stageKey, frameKey } = this.generateKeys()

    this.stageKey = stageKey
    this.frameKey = frameKey

    if (this.type === Gfx.Types.Tile) {
      return // TODO; Hack
    }

    this.frameRate = meta.frameRate
    this.triggerFrame = meta.triggerFrame
    this.animated = meta.animated

    //Object.assign(this, meta);

    this.variants = []
    this.stages = []

    let variantPath = `${spritePath}/${this.variant}`
    let keyPrefix = `${this.path}/${this.variant}`

    let stageDirs = await this.assetLoader.findDirs(variantPath)

    let promises = []

    for (let [key, value] of stageDirs) {
      let stageName = key // AGate.Utils.getLastDir(dir);
      let stagePath = `${variantPath}/${stageName}`
      let assetKey = `${keyPrefix}/${stageName}`

      let promise = this.scene.loadAsset(
        assetKey,
        `atlas`,
        {
          texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
          data: `${stagePath}/Stage.json`
        },
        this
      )

      /*let promise = this.loadSpritesheet(assetKey, {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      })*/

      //promises.push(promise) // TODO: spritesheets are not used in any way

      this.stages.push(stageName)
    }

    //return Promise.all(promises)

    this.variants[this.variant] = this.stages
  }

  /**
   * Generate sprite key and frame key according to current state
   * @returns {{key: string, frame: string}}
   */
  generateKeys(): Object {
    let frameKey, stageKey
    let currentPath = `${this.path}/${this.variant}`

    switch (this.type) {
      case Gfx.Types.Tile:
        stageKey = `tiles`
        frameKey = `${currentPath}/${this.stage}/Sprite.gif`
        break
      case Gfx.Types.Wall:
        stageKey = `${currentPath}/North`
        frameKey = `${stageKey}/${this.frame}`
        break
      case Gfx.Types.Portal:
        stageKey = `${currentPath}/North`
        frameKey = `${stageKey}/0`
        //this.animated = true;
        break
      default:
        stageKey = `${currentPath}/${this.stage}`
        frameKey = `${stageKey}/${this.frame}`
        break
    }

    return { stageKey, frameKey }
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
    // Generate key name
    let key = this.stageKey
    //key = key.substring(0, key.lastIndexOf(`/`))
    key = `${key}/${index}`

    this.frame = index
    this.setFrameByKey(key)
  }

  /**
   *
   * @param index
   */
  setFrameByKey(key: string) {
    let sprite = this.iso
    sprite.texture = key

    //sprite.displayOriginX = sprite.frame.centerX
    // sprite.displayOriginY = sprite.frame.centerY // TODO: Anchor

    this.frameKey = key
  }

  getCacheId() {
    let sprite = this.iso
    let texture = sprite.texture

    return texture.textureCacheIds[0]
  }

  /**
   *
   * @param stage
   */
  setStage(stage: string) {
    if (stage === this.stage) {
      return
    }

    console.log(`Changing to stage ${stage}`)
    this.stage = stage
    let { stageKey, frameKey } = this.generateKeys()

    this.setFrameByKey(frameKey)



    // Generate key name

    //lll('stage', key, stage, this.stage, this.path)




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

    lll('iso move', x ,y )
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

    let frameTime = (this.frameRate / 1000) * speed
    let frameIndex =
      Math.round(this.totalElapsed * frameTime) % (this.totalFrames - 1)


    if (!isNaN(frameIndex) && this.frame !== frameIndex) {
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
        mode = 'ADD'
        break
      case `BlendMul`:
        mode = 'MULTIPLY'
        break
      default:
        lll('unknown blend mode')
        return
    }
    this.iso.setBlendMode(mode)
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

    //let { stageKey, frameKey } = this.generateKeys()

    //console.log(`Changing to: ${key} - ${frame}`)

      //const spritesheet = this.getSpritesheetByKey(this.stageKey)
      //this.setSpritesheet(spritesheet)

  }

  /**
   *
   * @param name
   */
  setPipeline(name: string) {
    let sprite = this.iso
    sprite.setPipeline(name)
  }

  /**
   *
   * @param key
   * @returns {*}
   */
  getSpritesheetByKey(key) {
    let descriptor = this.assetLoader.getCachedAsset(key)
    if (!descriptor) {
      lll(`Sprite not in cache!`, key)
      return
    }

    if (!descriptor.spritesheet) {
      //lll(`Spritesheet missing!`, descriptor)
      return
    }

    return descriptor.spritesheet
  }

  /**
   *
   * @param spritesheet
   */
  setSpritesheet(spritesheet) {
    this.totalFrames = spritesheet.totalFrames
    this.setFrame(this.frame)
  }

  /**
   *
   * @param target - group
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
    //if (this.type === Gfx.Types.Tile)
    //  console.log(x, y, z, offset)

    if (this.type === Gfx.Types.Tile) {
      let { stageKey, frameKey } = this.generateKeys()
      //lll(`tile`, frameKey)
      this.setFrameByKey(frameKey)
    }

    let sprite = this.iso
    sprite.addToContainer(target, x, y, z, offset)

    //this.offset = offset

    switch (this.type) {
      case Gfx.Types.Wall:
      case Gfx.Types.Portal:
        sprite.alpha = 0.7
        break
    }

    sprite.interactive = true

    if (this.meta.flipped && this.type !== Gfx.Types.Facade) {
      //this.sprite.originX = 0.5;
      sprite.scale.x *= -1

      //this.sprite.flipX = true;
      sprite.resetIsoBounds()
    }



    /*if (this.animated) {
      for (let stageIndex = 0; stageIndex < this.stages.length; stageIndex++) {
        let stageName = this.stages[stageIndex];
        let stagePath = `${this.path}/${this.variant}/${stageName}`;

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

  onResourceLoaded(descriptor) {
    let spritesheet = this.getSpritesheetByKey(descriptor.key)
    if (!spritesheet) {
      //lll('spritesheet', descriptor)
      descriptor = Sprite.createSpritesheet(descriptor)
      spritesheet = descriptor.spritesheet
    }

   // if (this.stageKey == 'Critter/Human/Male/ChainMail/None/Unarmed/Stand/0/South') {
   //   lll('fdfsfdsfsdf', descriptor, spritesheet)
    //}

    //if (descriptor.key === this.frameKey) {
    this.setSpritesheet(spritesheet)
    //}
  }
}
