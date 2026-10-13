import type { Sprite as PixiSprite } from 'pixi.js'
interface RenderOptions { assetName?: string; spriteURL?: string; width?: number; height?: number; onRenderableCreated?: (sprite: PixiSprite | undefined, component: PixiRenderableComponent) => PixiSprite; onRender?: () => void }
import GameComponent from '../../../shared/serialize/GameComponent'
import PIXI from '../../libs/PIXI'

export default class PixiRenderableComponent extends GameComponent {
  declare options: RenderOptions

  constructor(options: RenderOptions) {
    super()
    this.options = options
  }

  /**
   * Initial creation of the Pixi renderable
   * @returns A pixi container/sprite
   */
  createRenderable() {
    let sprite
    if (this.options.assetName) {
      sprite = new PIXI.Sprite(PIXI.Texture.from(this.options.assetName))
    } else if (this.options.spriteURL) {
      // Pixi 8 accepts loaded texture keys here, not asynchronous URLs.
      sprite = new PIXI.Sprite(PIXI.Texture.from(this.options.spriteURL))
    }

    if (this.options.width) {
      sprite!.width = this.options.width
    }

    if (this.options.height) {
      sprite!.height = this.options.height
    }

    if (this.options.onRenderableCreated) {
      sprite = this.options.onRenderableCreated(sprite, this)
    }

    return sprite
  }

  /**
   * This method gets executed on every render step
   * Note - this should only include rendering logic and not game logic
   */
  render() {
    if (this.options.onRender) {
      this.options.onRender()
    }
  }
}
