// @flow


export default class Camera {


  constructor(viewport: Object) {
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
