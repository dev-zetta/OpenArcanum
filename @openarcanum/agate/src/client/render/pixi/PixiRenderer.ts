import type { Sprite, Container, Filter, FederatedPointerEvent } from 'pixi.js'
interface RenderObject { id: string; position: {x: number; y: number}; angle: number; hasComponent(component: typeof PixiRenderableComponent): boolean; getComponent(component: typeof PixiRenderableComponent): PixiRenderableComponent }
interface DisplayObject extends Container { data?: unknown }
import type ClientEngine from '../../ClientEngine'

import PIXI from '../../libs/PIXI'
import BaseRenderer from '../BaseRenderer'
import PixiRenderableComponent from './PixiRenderableComponent'

/**
 * Pixi Renderer
 */
export default class PixiRenderer extends BaseRenderer {
  declare sprites: Record<string, Sprite>
  declare isReady: boolean
  declare stopped: boolean
  declare viewport: InstanceType<typeof PIXI.Viewport>
  declare layers: { "base": InstanceType<typeof PIXI.Container> }


  constructor(clientEngine: ClientEngine) {
    super(clientEngine)
    this.sprites = {}
    this.isReady = false

    this.stopped = false
  }

  get stage() {
    return this.viewport
  }

  get pixi() {
    return this.clientEngine.scene.pixi
  }

  get renderer() {
    return this.pixi.renderer
  }

  /**
   *
   * @returns {Promise}
   */
  async init(): Promise<boolean | void> {
    await super.init()

    this.viewport = new PIXI.Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: 1000,
      worldHeight: 1000,

      events: this.renderer.events,
      // AGate advances the viewport from its own render scheduler.
      noTicker: true
    })

    this.pixi.stage.addChild(this.viewport)

    this.viewport.on("pointertap", (event: FederatedPointerEvent) => {
      if (event.target) {
        this.onDisplayObjectClick(event.target)
      }

    })

    this.viewport
      .drag()
      .pinch()
      .wheel()
      .decelerate()

    // default layers
    this.layers = {
      base: new PIXI.Container()
    }

    this.stage.addChild(this.layers.base)

    //container.setParent(parent)
    this.isReady = true
    return true
  }

  /**
   *
   * @param t
   * @param dt
   */
  draw(t: number, dt: number) {
    super.draw(t, dt)

    if (!this.isReady) {
      lll(`not ready`)
      return // assets might not have been loaded yet
    }

    for (let objId of Object.keys(this.sprites)) {
      let objData = (this.gameEngine.world as unknown as { objects: Record<string, RenderObject> }).objects[objId]
      let sprite = this.sprites[objId]

      if (objData) {
        sprite.x = objData.position.x
        sprite.y = objData.position.y
        sprite.rotation =
          ((this.gameEngine.world as unknown as { objects: Record<string, RenderObject> }).objects[objId].angle * Math.PI) / 180
      }
    }

    this.viewport.update(dt)
    const scene = this.clientEngine.scene
    if (scene.roofLayer) scene.roofLayer.updateVisibility(this.clientEngine.player?.base.location)
    if (scene.lightLayer) scene.lightLayer.update()
    this.renderer.render({ container: this.pixi.stage })
  }

  /**
   *
   * @param obj
   */
  addObject(input: unknown) {
    const obj = input as RenderObject
    if (obj.hasComponent(PixiRenderableComponent)) {
      let renderable = obj.getComponent(PixiRenderableComponent)
      let sprite =( this.sprites[obj.id] = renderable.createRenderable()!)
      sprite.anchor.set(0.5, 0.5)
      sprite.position.set(obj.position.x, obj.position.y)
      this.layers.base.addChild(sprite)
    }
  }

  /**
   *
   * @param obj
   */
  removeObject(input: unknown) {
    const obj = input as RenderObject
    if (obj.hasComponent(PixiRenderableComponent)) {
      let sprite = this.sprites[obj.id]
      if (sprite) {
        this.sprites[obj.id].destroy()
        delete this.sprites[obj.id]
      }
    }
  }

  /**
   *
   * @param time
   * @param delta
   */
  update(time: number, delta: number) {
    this.draw(time, delta)
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async start() {
    await super.start()
  }

  /**
   *
   * @param object
   */
  onDisplayObjectClick(object: DisplayObject) {

  }

  newFilter(name: string, options?: unknown): Filter {
    const FilterType = Reflect.get(PIXI.Filters2, name) as (new (options?: unknown) => Filter) | undefined
    if (!FilterType) throw new Error(`Unknown Pixi filter: ${name}`)
    return new FilterType(options)
  }

}
