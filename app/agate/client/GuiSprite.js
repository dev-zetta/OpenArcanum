/* global AGate */

export class Sprite {
  /**
   *
   * @param key
   * @param json
   */
  constructor(key, json) {
    this.key = key

    let isUrl = key.indexOf(`://`) !== -1
    if (isUrl) {
      this.type = 'src'
      this.frames = []
    } else {
      this.type = 'class'
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

  get className() {
    return AGate.Utils.kebabCase(this.key)
  }

  getFrame(index = 0) {
    return this.frames[index]
  }

  hasFrame(index) {
    return index < this.frames.length
  }

  getFrameCount() {
    return this.frames.length
  }

  getLastFrame() {
    return this.frames[this.frames.length - 1]
  }

  static fromUrl(url) {
    return new Sprite(url)
  }

  attachToElement(element) {
    switch (this.type) {
      case 'src':
        element.css({
          backgroundImage: `url("${this.key}")`,
          backgroundPosition: 'center'
        })
        break
      case 'class':
        element.addClass(this.className)
        break
    }

  }

  detachFromElement(element) {
    switch (this.type) {
      case 'src':
        element.css({
          backgroundImage: ``
        })
        break
      case 'class':
        element.removeClass(this.className)
        break
    }


  }


}
