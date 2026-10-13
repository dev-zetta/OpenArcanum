import type { Container, Filter as PixiFilter } from 'pixi.js'
import type { AssetDescriptor } from '../shared/assets/AssetLoader'
import type { VisualClass } from '../shared/entity/components/Visual'
import type { SpritesheetData, Point2Like } from './isometric/GeometryTypes'
interface AtlasDescriptor extends AssetDescriptor { spritesheet?: Spritesheet; stageName?: string }
interface Stage { name: string; spritesheet?: Spritesheet }
interface SpriteMeta { frameRate: number; animated: boolean; imageExtension?: string }
import type Scene from './Scene'
export type Meta = {  }
import Gfx from '../shared/enums/Gfx'
import Math from '../shared/misc/Math'
import IsoSprite from './isometric/Sprite'
import Utils from '../shared/misc/Utils'
import GfxPathBuilder from '../shared/assets/GfxPathBuilder'

import Spritesheet from './isometric/Spritesheet'
import Vec2 from '../shared/misc/Vec2'

export default class Sprite {
  declare meta: VisualClass
  declare portalStateFrame: number

  declare scene: Scene
  declare totalElapsed: number
  declare flipped: boolean
  declare stageKey: string
  declare frame: number
  declare frameKey: string
  declare frameRate: number
  declare triggerFrame: number
  declare path: string
  declare variant: number
  declare animated: boolean
  declare loading: boolean
  declare variants: Record<string, Stage>[]
  declare stages: Record<string, Stage>
  declare data: unknown
  declare offset: Vec2
  declare iso: IsoSprite & { data: Sprite }
  declare onTriggerFrame: (() => void) | undefined


                   // stage key

  //meta: Meta

  /**
   *
   * @param scene
   */
  constructor(scene: Scene) {
    this.scene = scene
    this.totalElapsed = 0
    this.animated = false
    this.loading = false
    this.frame = 0

    let sprite = new IsoSprite(this.scene.isometric) as IsoSprite & { data: Sprite }
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

  /**
   *
   * @returns {*}
   */
  get spritesheet() {
    let stage = this.stage!
    switch (
      this.type // TODO: Better way
    ) {
      case Gfx.Types.Tile:
      case Gfx.Types.Wall:
      case Gfx.Types.Portal:
        stage = `North`
        break
    }

    if (!this.stages[stage]) {
      lll(`No stage`, stage, this.stages, this)
      return null
    }

    return this.stages[stage].spritesheet
  }

  /**
   *
   * @returns {number}
   */
  get totalFrames(): number {
    const spritesheet = this.spritesheet
    return spritesheet ? spritesheet.totalFrames : 0
  }

  /**
   *
   * @returns {PIXI.Point}
   */
  getGlobalPosition() {
    let sprite = this.iso

    let position = sprite.getGlobalPosition()
    let bounds = this.iso.getBounds()
    // position.x -= (sprite.width * sprite.anchor.x) / 2
    //position.y -= sprite.height

    return position
  }

  /**
   *
   * @param key
   * @param options
   * @returns {Promise<Spritesheet>}
   */
  async loadSpritesheet(key: string, options: Record<string, unknown>): Promise<Spritesheet> {
    const spritesheet = this.getSpritesheetByKey(key)
    if (spritesheet) {
      return spritesheet
    }

    let descriptor = await this.scene.loadAsset(key, `atlas`, options) as AtlasDescriptor | null | undefined
    // Parallel sprite instances must share the canonical descriptor, including
    // the spritesheet assigned after the image promise resolves.
    descriptor = this.assetLoader.getCachedAsset(key) as AtlasDescriptor | undefined || descriptor

    if (!descriptor) throw new Error(`Missing atlas: ${key}`)
    if (descriptor.spritesheet) {
      return descriptor.spritesheet!
    }

    if (!descriptor.spritesheet) descriptor = Sprite.createSpritesheet(descriptor)
    return descriptor.spritesheet!
  }

  /**
   *
   * @param descriptor
   * @returns {*}
   */
  static createSpritesheet(descriptor: AtlasDescriptor): AtlasDescriptor & { spritesheet: Spritesheet } {
    let spritesheet = Spritesheet.newSpritesheet(
      descriptor.key,
      descriptor.image as ImageBitmap,
      descriptor.meta as SpritesheetData
    )

    descriptor.spritesheet = spritesheet

    delete descriptor.image
    delete descriptor.meta

    return descriptor as AtlasDescriptor & { spritesheet: Spritesheet }
  }

  /**
   *
   * @returns {*}
   */
  get type() {
    return Gfx.Types.get(this.meta.type as string)
  }

  /**
   *
   * @returns {*}
   */
  get stage(): string {
    return this.meta.stage as string
  }

  /**
   *
   * @param stage
   */
  set stage(stage: string) {
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
  async load(source: Record<string, unknown>): Promise<void> {
    // Keep the last complete texture while metadata and direction atlases load.
    // Advancing the old Walk sheet here could select an invalid Stand frame.
    this.loading = true
    try {
      await this.loadFrames(source)
    } finally {
      this.loading = false
    }
  }

  async loadFrames(source: Record<string, unknown>): Promise<void> {
    let dataPath = AGate.getDataPath(`Gfx/2D`)

    let path = ``
    if (Utils.isObject(source)) {
      if (Utils.isUndefined(source.type)) {
        lle('Loading sprite data for undefined sprite type', source.type)
        return
      }

      path = GfxPathBuilder.build(source)
      if (!this.meta /*|| !(source instanceof Sprite)*/) {
        this.meta = source
      }

      if (!Utils.isUndefined(source.frame)) {
        this.frame = source.frame as number
      }
    } else {
      path = source as unknown as string
    }

    this.path = path // TODO: Prevents loading other files
    this.variant = 0

    if (Utils.isUndefined(this.stage)) {
      this.stage = `North`
    }

    let { stageKey, frameKey } = this.generateKeys()

    this.stageKey = stageKey
    this.frameKey = frameKey

    if (this.type === Gfx.Types.Tile) {
      if (!this.getSpritesheetByKey('tiles')?.textures[this.frameKey]) {
        throw new Error(`Missing tile atlas frame: ${this.frameKey}`)
      }
      return
    }
    let spritePath = `${dataPath}/${this.path}`
    //console.log(`Loading: ${spritePath}`);

    let meta = await this.assetLoader.loadJsonFile(`${spritePath}/Meta.json`) as SpriteMeta | null
    if (!meta) {
      throw new Error(`Missing converted sprite: ${spritePath}/Meta.json`)
    }

    if (this.type === Gfx.Types.Tile) {
      return // TODO; Hack
    }

    this.frameRate = meta.frameRate
    this.triggerFrame = 1
    this.animated = meta.animated
    const imageExtension = meta.imageExtension ?? (AGate.Const as { Sprite?: { DefaultExt?: string } })?.Sprite?.DefaultExt ?? 'gif'
    if (!['gif', 'png'].includes(imageExtension)) {
      throw new Error(`Unsupported sprite image extension: ${imageExtension}`)
    }

    // if (this.animated) {
    //   lle(`anim`, meta)
    // }

    let variantPath = `${spritePath}/${this.variant}`
    let keyPrefix = `${this.path}/${this.variant}`

    let stageDirs = await this.assetLoader.findDirs(variantPath)

   // let promises = []

    for (let [key, value] of stageDirs) {
      let stageName = key as string // AGate.Utils.getLastDir(dir);
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
      this.stages[stageName].spritesheet = await this.loadSpritesheet(assetKey, {
        texture: `${stagePath}/Sprite.${imageExtension}`,
        data: `${stagePath}/Stage.json`,
        stageName
      })
    }

    //return Promise.all(promises)
    this.variants[this.variant] = this.stages
    if (!this.spritesheet) throw new Error(`Missing sprite direction: ${this.path}/${this.stage}`)
    this.setFrame(this.frame)
  }

  /**
   * Generate sprite key and frame key according to current state
   * @returns {{key: string, frame: string}}
   */
  generateKeys(): { stageKey: string; frameKey: string } {
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
        frameKey = `${stageKey}/${this.frame}`
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
  setData(data: unknown) {
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
    //let key = this.stageKey
    //key = `${key}/${index}`

    this.frame = index
    //this.setFrameByKey(key)

    let sprite = this.iso
    sprite.texture = spritesheet.getTextureByIndex(this.frame)!
  }

  // Door poses are committed server state, not a looping decoration animation.
  setPortalState(frame: number) {
    if (this.type !== Gfx.Types.Portal || !Number.isInteger(frame) || frame < 0 || frame >= this.totalFrames) {
      throw new Error(`Unsupported portal pose: ${frame}`)
    }
    this.portalStateFrame = frame
    this.totalElapsed = 0
    this.setFrame(frame)
    this.frameKey = this.generateKeys().frameKey
  }

  /**
   *
   * @param key
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

    this.setFrameByKey(this.frameKey)
    //this.setFrame(0)
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
  setPosition(x: number, y: number) {
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
    if (this.loading) return
    if (this.portalStateFrame !== undefined) return
    const spritesheet = this.spritesheet
    if (!spritesheet || spritesheet.totalFrames <= 2) {
      //this.setFrame(this.frame)
      return
    }

    this.totalElapsed += elapsed

    let frameTime = (this.frameRate / 1000.0) * speed
    let frameIndex =
      Math.floor(this.totalElapsed * frameTime) % spritesheet.totalFrames

    if (this.frame !== frameIndex) {
      if (!this.animated && frameIndex < this.frame) {
        this.totalElapsed -= elapsed
        return
      }

      const isTrigger =
        this.frame < this.triggerFrame && frameIndex >= this.triggerFrame
      if (isTrigger && this.onTriggerFrame) {
        this.onTriggerFrame()
      }

      //this.setFrame(frameIndex)

      this.frame = frameIndex

      let sprite = this.iso
      sprite.texture = spritesheet.getTextureByIndex(this.frame)!
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
  async change(data: Record<string, unknown>) {
    console.debug(`Changing sprite animation`, data.animation)

    //lle(this.path, this.stages)
    this.frame = 0
    await this.load(data)

    //lle(this.path, this.stages)

    //this.frame = 0
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
    throw new Error(`Named pipelines are unsupported by the Pixi renderer: ${name}`)
  }

  /**
   *
   * @param key
   * @returns {*}
   */
  getSpritesheetByKey(key: string): Spritesheet | undefined {
    let descriptor = this.assetLoader.getCachedAsset(key) as AtlasDescriptor | undefined
    if (!descriptor) {
      //lll(`Sprite not in cache!`, key)
      return
    }

    if (!descriptor.spritesheet) {
      //lll(`Spritesheet missing!`, descriptor)
      return
    }

    return descriptor.spritesheet!
  }

  /**
   *
   * @param spritesheet
   */
  setFilter(...args: PixiFilter[]) {
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
    target: Container,
    x: number,
    y: number,
    z: number = 0,
    offset: Point2Like | null = null
  ) {
    this.offset = new Vec2(offset ? offset.x : 0, offset ? offset.y : 0)

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

    sprite.eventMode = 'static'

    if (this.meta.flipped && this.type !== Gfx.Types.Facade) {
      //this.sprite.originX = 0.5;
      sprite.scale.x *= -1
      sprite.resetIsoBounds()
    }
  }

  onResourceLoaded(descriptor: AtlasDescriptor, firstTime?: boolean) {
    // let stageName = Utils.getFileName(descriptor.key)

    let stage = this.stages[descriptor.stageName!]
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
