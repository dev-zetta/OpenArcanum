/* global AGate */

import { Sprite } from './GuiSprite'

class Manager {
  /**
   *
   * @param engine
   */
  constructor(engine) {
    this.engine = engine
    this.sprites = new Map()

    this.widgets = new Map()
  }

  /**
   *
   * @returns {{}}
   */
  static loadComponents() {
    let resolve = {}
    let result = {}

    AGate.Utils.loadScripts(`client/gui`, (name, script) => {
      let widget = script
      if (widget.parent) {
        resolve[name] = widget
      } else {
        result[name] = widget
      }
    })

    for (let key in resolve) {
      let widget = resolve[key]
      result[widget.parent][`components`][key] = widget
    }

    return result
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadAssets() {
    await this.generateAssets()

    let assetPath = AGate.getAppPath(`gui`)
    let assetLoader = this.engine.assetLoader

    let guiMeta = await assetLoader.loadJsonFile(`${assetPath}/gui-images.json`)

    for (let key in guiMeta) {
      let imageMeta = guiMeta[key]

      let sprite = new Sprite(key, imageMeta)
      this.sprites.set(key, sprite)
    }

    /*let assetLoader = this.engine.assetLoader;
    let guiPath = AGate.getDataPath('Interface');

    let files = await assetLoader.findFiles(guiPath, '.json');

    for (let i = 0; i < files.length; i++) {
      let jsonFile = files[i];

      let dotPos = jsonFile.lastIndexOf(".");
      let slashPos = jsonFile.lastIndexOf("/");
      let key = jsonFile.substring(slashPos + 1, dotPos);

      let json = await assetLoader.loadJsonFile(jsonFile);
      let sprite = new Sprite(key, json);

      this.sprites[key] = sprite;
    }*/
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async generateAssets() {
    let targetPath = AGate.getAppPath(`gui`)
    let targetCss = `${targetPath}/gui-images.css`

    return
    if (AGate.Utils.isFileExist(targetCss)) {
      return
    }

    console.error('generating assets')

    let assetLoader = this.engine.assetLoader
    let guiPath = AGate.getAppPath('Interface');

    let files = await assetLoader.findFiles(guiPath, `.json`)

    for (let i = 0; i < files.length; i++) {
      let jsonFile = files[i]

      let dotPos = jsonFile.lastIndexOf(`.`)
      let imageFile = jsonFile.substr(0, dotPos)

      let slashPos = jsonFile.lastIndexOf(`/`)
      let key = jsonFile.substring(slashPos + 1, dotPos)

      //console.log(key, imageFile, jsonFile)
      assetLoader.preload({
        key,
        type: `atlas`,
        texture: [`${imageFile}.gif`, `${imageFile}.png`],
        data: jsonFile,
        output: `base64`
      })
    }

    let json = {}
    let css = ``

    await assetLoader.loadAssets(null, descriptor => {
      // generate css
      let className = AGate.Utils.kebabCase(descriptor.key)
      css += `.${className} {background-image: url('${descriptor.image}');}\n`

      // generate json
      let frames = []
      let jsonFrames = descriptor.meta[`frames`]
      for (let key in jsonFrames) {
        let jsonFrame = jsonFrames[key][`frame`]

        let index = key.substr(key.lastIndexOf(`/`) + 1)

        frames[index] = {
          left: jsonFrame.x,
          top: jsonFrame.y,
          width: jsonFrame.w,
          height: jsonFrame.h
        }
      }

      json[descriptor.key] = frames
    })


    await assetLoader.saveTextFile(targetCss, css)
    await assetLoader.saveJsonFile(`${targetPath}/gui-images.json`, json)
  }

  /**
   *
   * @param key
   * @returns {V | undefined}
   */
  getSprite(key) {
    //key = AGate.Utils.kebabCase(key);
    let sprite = this.sprites.get(key)
    if (sprite) {
      return sprite
    }
  }

  /**
   *
   * @returns {Map|Map<any, any>}
   */
  getWidgets() {
    return this.widgets
  }

  /**
   *
   * @param widget
   */
  addWidget(widget) {
    this.widgets.set(widget.get(`widget.id`), widget)
  }

  /**
   *
   * @param id
   * @param children
   * @returns {null}
   */
  findWidget(id, children = null) {
    if (!children) {
      children = this.widgets
    }

    let widget = children.get(id)
    if (widget) {
      return widget
    }

    for (let [key, value] of children) {
      let widget = this.findWidget(id, value.children)
      if (widget) {
        return widget
      }
    }

    return null
  }

  /**
   *
   * @param window
   */
  bringWindowTop(window) {
    if (this.currentWindow) {
      this.currentWindow.bringToBack()
    }

    window.bringToFront()

    this.currentWindow = window
  }

  /**
   *
   * @returns {*}
   */
  getRootWidget() {
    return this.rootWidget
  }

  /**
   *
   * @param widget
   */
  setRootWidget(widget) {
    this.rootWidget = widget
  }

  /**
   *
   * @returns {jQuery|HTMLElement|*}
   */
  getMouseElement() {
    if (!this.mouseElement) {
      this.mouseElement = document.getElementById(`mouse-pointer`)
    }

    return this.mouseElement
  }

  /**
   *
   * @param event
   */
  onMouseMove(event) {
    let element = this.getMouseElement()

    element.offset({
      top: event.pageY,
      left: event.pageX
    })
  }

  /**
   *
   * @param key
   * @param index
   */
  setMouseSprite(key, index = 0) {
    let sprite = this.getSprite(key)

    if (!sprite) {
      return
    }

    let frame = sprite.getFrame(index)

    let element = this.getMouseElement()

    if (this.prevMouseClass) {
      element.removeClass()
    }

    element.addClass(sprite.className)
    /*element.css({
      'width': `${frame.width}px`,
      'height': `${frame.height}px`,
    });*/

    console.log(element.css(`background-image`))
    this.getRootWidget()
      .getElement()
      .css(`cursor`, element.css(`background-image`) + `, auto`)

    this.prevMouseClass = sprite.className
  }

  /**
   *
   * @param object
   * @returns {string}
   */
  static objectToJson(object) {
    return JSON.stringify(object, (key, value) => {
      if (typeof value === `function`) {
        return `@` + value.toString()
      }
      return value
    })
  }

  /**
   *
   * @param json
   * @returns {any}
   */
  static jsonToObject(json) {
    return JSON.parse(json, (key, value) => {
      if (key === ``) return value

      if (typeof value === `string` && value.startsWith(`@`)) {
        return AGate.Utils.stringToFunction(value.substr(1))
      }
      return value
    })
  }
}

export { Manager }
