import type { Viewport } from 'pixi-viewport'
export default class Camera {
  declare viewport: Viewport


  constructor(viewport: Viewport) {
    this.viewport = viewport
  }

  get x() {
    return this.viewport.left
  }

  get y() {
    return this.viewport.top
  }

  get width() {
    return this.viewport.worldScreenWidth

  }

  get height() {
    return this.viewport.worldScreenHeight
  }

}
