/* global AGate */

export class Sprite {
  constructor(key, json) {
    this.frames = json

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

    this.className = AGate.Utils.kebabCase(key)
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
}
