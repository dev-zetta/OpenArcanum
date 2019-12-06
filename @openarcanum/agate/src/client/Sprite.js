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
  stages: Array<Object>
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
    this.animated = false
    this.frame = 0

    let sprite = new IsoSprite(this.scene.isometric)
    sprite.data = this

    this.iso = sprite

    this.variants = []
    this.stages = {}
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

  get spritesheet() {
    let stage = this.stage
    switch (
      this.type // TODO: Better way
    ) {
      case Gfx.Types.Tile:
      case Gfx.Types.Wall:
        stage = `North`
        break
    }

    if (!this.stages[stage]) {
      lll(`No stage`, stage, this.stages, this)
      return null
    }

    return this.stages[stage].spritesheet
  }

  get totalFrames() {
    const spritesheet = this.spritesheet
    return spritesheet ? spritesheet.totalFrames : 0
  }

  getGlobalPosition() {
    let sprite = this.iso

    let position = sprite.getGlobalPosition()
    let bounds = this.iso.getBounds()
    position.x -= (sprite.width * sprite.anchor.x) / 2
    position.y -= bounds.height


    return position
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

  /**
   *
   * @param descriptor
   * @returns {*}
   */
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

  /*get frame() {
    return this.meta.frame
  }

  set frame(frame) {
    this.meta.frame = frame
  }*/

  /**
   *
   * @returns {Promise<void>}
   * @param source
   */
  async load(source: Object): Promise<void> {
    let dataPath = AGate.getDataPath(`Gfx/2D`)

    let path = ``
    if (Utils.isObject(source)) {
      if (Utils.isUndefined(source.type)) {
        //lll('Loading sprite data for undefined sprite type')
        return
      }

      path = GfxPathBuilder.build(source)
      if (!this.meta /*|| !(source instanceof Sprite)*/) {
        this.meta = source
      } else {
        if (this.path === path) {
          //return
        }
      }

      if (!Utils.isUndefined(source.frame)) {
        this.frame = source.frame
      }
    } else {
      path = source
    }

    this.path = path // TODO: Prevents loading other files
    this.variant = 0

    if (Utils.isUndefined(this.stage)) {
      this.stage = `North`
    }

    let { stageKey, frameKey } = this.generateKeys()

    this.stageKey = stageKey
    this.frameKey = frameKey

    let spritePath = `${dataPath}/${this.path}`
    //console.log(`Loading: ${spritePath}`);

    let meta = await this.assetLoader.loadJsonFile(`${spritePath}/Meta.json`)
    if (!meta) {
      lll(`Unable to load sprite: ${`${spritePath}/Meta.json`}`)
      return
    }

    if (this.type === Gfx.Types.Tile) {
      return // TODO; Hack
    }

    this.frameRate = meta.frameRate
    this.triggerFrame = meta.triggerFrame
    this.animated = meta.animated



    let variantPath = `${spritePath}/${this.variant}`
    let keyPrefix = `${this.path}/${this.variant}`

    let stageDirs = await this.assetLoader.findDirs(variantPath)

    let promises = []

    for (let [key, value] of stageDirs) {
      let stageName = key // AGate.Utils.getLastDir(dir);
      let assetKey = `${keyPrefix}/${stageName}`

      const spritesheet = this.getSpritesheetByKey(assetKey)

      this.stages[stageName] = {
        name: stageName,
        spritesheet
      }

      if (spritesheet) {
        continue
      }

      let stagePath = `${variantPath}/${stageName}`
      let promise = this.scene.loadAsset(
        assetKey,
        `atlas`,
        {
          texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
          data: `${stagePath}/Stage.json`,
          stageName
        },
        this
      )

      /*let promise = this.loadSpritesheet(assetKey, {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      })*/

      //promises.push(promise) // TODO: spritesheets are not used in any way
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
    const spritesheet = this.spritesheet
    if (!spritesheet) {
      //lle('no spritesheet', this.stage, this.stageKey)
      return
    }

    // Generate key name
    let key = this.stageKey
    key = `${key}/${index}`

    this.frame = index
    //this.setFrameByKey(key)

    let sprite = this.iso
    sprite.texture = spritesheet.getTextureByIndex(this.frame)
  }

  /**
   *
   * @param index
   */
  setFrameByKey(key: string) {
    let sprite = this.iso
    sprite.texture = key
    this.frameKey = key
  }

  /**
   *
   * @param stage
   */
  setStage(stage: string) {
    if (stage === this.stage) {
      return
    }

    lll(`Changing to stage ${stage}`)
    this.stage = stage
    //let { stageKey, frameKey } = this.generateKeys()
    //
    //this.stageKey = stageKey

    //this.setFrameByKey(frameKey)
    this.setFrame(0)
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

    //lll('iso move', x ,y )
    sprite.isoMove(x, y)
    sprite.postUpdate()
  }

  /**
   *
   * @param x
   * @param y
   */
  setPosition(x, y) {
    let sprite = this.iso
    sprite.isoX = x
    sprite.isoY = y
    //lll(this.iso.offset)
    sprite.postUpdate()
  }

  /**
   *
   * @param elapsed
   * @param speed
   */
  update(elapsed: number, speed: number = 1.0) {
    this.totalElapsed += elapsed

    if (this.totalFrames <= 2) {
      //this.setFrame(this.frame)
      return
    }

    let frameTime = (this.frameRate / 1000.0) * speed
    let frameIndex =
      Math.floor(this.totalElapsed * frameTime) % this.totalFrames

    if (this.frame !== frameIndex) {
      const isTrigger =
        this.frame < this.triggerFrame && frameIndex >= this.triggerFrame
      if (isTrigger && this.onTriggerFrame) {
        this.onTriggerFrame()
      }

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
        mode = `ADD`
        break
      case `BlendMul`:
        mode = `MULTIPLY`
        break
      default:
        lll(`unknown blend mode`)
        return
    }
    this.iso.setBlendMode(mode)
  }

  /**
   *
   * @param color
   */
  setTint(color: string) {
    this.iso.tint = color
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async change(data: Object) {
    lll('changin sprite', data)

    //lle(this.path, this.stages)
    await this.load(data)

    //lle(this.path, this.stages)

    //this.frame = 0
    //this.totalElapsed = 0

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
      //lll(`Sprite not in cache!`, key)
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
  setFilter(...args) {
    this.iso.filters = [...args]
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
    this.offset = new Vec2(offset.x, offset.y)

    //if (this.type === Gfx.Types.Tile)
    //  console.log(x, y, z, offset)

    if (this.type === Gfx.Types.Tile) {
      let { stageKey, frameKey } = this.generateKeys()
      //lll(`tile`, frameKey)
      this.setFrameByKey(frameKey)
    } else {
    }

    let sprite = this.iso
    sprite.addToContainer(target, x, y, z, this.offset)

    switch (this.type) {
      case Gfx.Types.Wall:
      case Gfx.Types.Portal:
        sprite.alpha = 0.6
        break
    }

    sprite.interactive = true

    if (this.meta.flipped && this.type !== Gfx.Types.Facade) {
      //this.sprite.originX = 0.5;
      sprite.scale.x *= -1
      sprite.resetIsoBounds()
    }
  }

  onResourceLoaded(descriptor, firstTime) {
    // let stageName = Utils.getFileName(descriptor.key)

    let stage = this.stages[descriptor.stageName]
    if (!stage) {
      lll(`No stage`)
    }

    let spritesheet = this.getSpritesheetByKey(descriptor.key)
    if (firstTime || !spritesheet) {
      //lll('spritesheet', descriptor)
      descriptor = Sprite.createSpritesheet(descriptor)
      spritesheet = descriptor.spritesheet
    }

    // if (this.stageKey == 'Critter/Human/Male/ChainMail/None/Unarmed/Stand/0/South') {
    //   lll('fdfsfdsfsdf', descriptor, spritesheet)
    //}

    stage.spritesheet = spritesheet
    //if (descriptor.stageName === this.stage) {
    this.setFrame(this.frame)
    //}
  }
}
