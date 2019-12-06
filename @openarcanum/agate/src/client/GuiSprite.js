import Utils from '../shared/misc/Utils'

export default class Sprite {
  /**
   *
   * @param key
   * @param json
   */
  constructor(key, json) {
    this.key = key

    let isUrl = key.indexOf(`://`) !== -1
    if (isUrl) {
      this.type = `src`
      this.frames = []
    } else {
      this.type = `class`
      this.frames = json
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
  hasFrame(index) {
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
  static fromUrl(url) {
    return new Sprite(url)
  }

  /**
   *
   * @param element
   */
  attachToElement(element) {
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
  detachFromElement(element) {
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
