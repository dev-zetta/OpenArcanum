interface GuiElement { css(properties: Record<string, string>): unknown; addClass(name: string): unknown; removeClass(name: string): unknown }
import Utils from '../shared/misc/Utils'

export default class Sprite {
  declare key: string
  declare type: string
  declare frames: unknown[]

  /**
   *
   * @param key
   * @param json
   */
  constructor(key: string, json?: unknown[]) {
    this.key = key

    let isUrl = key.indexOf(`://`) !== -1
    if (isUrl) {
      this.type = `src`
      this.frames = []
    } else {
      this.type = `class`
      this.frames = json!
    }

    /* let jsonFrames = json['frames'];
     for (let key in jsonFrames) {
       let jsonFrame = jsonFrames[key]['frame'];

       let index = key.substr(key.lastIndexOf('/') + 1);

       this.frames[index] = {
         left: jsonFrame.x,
         top: jsonFrame.y,
         width: jsonFrame.w,
         height: jsonFrame.h
       };

     }*/
  }

  /**
   *
   */
  get className() {
    return Utils.kebabCase(this.key)
  }

  /**
   *
   * @param index
   * @returns {*}
   */
  getFrame(index = 0) {
    return this.frames[index]
  }

  /**
   *
   * @param index
   * @returns {boolean}
   */
  hasFrame(index: number) {
    return index < this.frames.length
  }

  /**
   *
   * @returns {number}
   */
  getFrameCount() {
    return this.frames.length
  }

  /**
   *
   * @returns {*}
   */
  getLastFrame() {
    return this.frames[this.frames.length - 1]
  }

  /**
   *
   * @param url
   * @returns {Sprite}
   */
  static fromUrl(url: string) {
    return new Sprite(url)
  }

  /**
   *
   * @param element
   */
  attachToElement(element: GuiElement) {
    switch (this.type) {
      case `src`:
        element.css({
          backgroundImage: `url("${this.key}")`,
          backgroundPosition: `center`
        })
        break
      case `class`:
        element.addClass(this.className)
        break
    }
  }

  /**
   *
   * @param element
   */
  detachFromElement(element: GuiElement) {
    switch (this.type) {
      case `src`:
        element.css({
          backgroundImage: ``
        })
        break
      case `class`:
        element.removeClass(this.className)
        break
    }
  }
}
