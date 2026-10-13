import type GameEngine from '../shared/GameEngine'
import type Entity from '../shared/entity/Entity'
import type { AssetDescriptor } from '../shared/assets/AssetLoader'
import type { SpritesheetData } from './isometric/GeometryTypes'
interface DebugGui { destroy(): void; addFolder(name: string): DebugGui; add(object: object, key: string): unknown }
interface GuiWidget { hide(): void; show(): void; children?: Map<string, GuiWidget>; get(key: 'widget.id'): string; get(key: 'widget.visible'): boolean; bringToBack(): void; bringToFront(): void; createChild(options: { id: string; type: string; position: number[]; value: string; options: object }): unknown; getChild(id: string): GuiWidget | undefined; update(entity: Entity): void }
interface GuiFrame { left: number; top: number; width: number; height: number }
/* global AGate */

import Utils from '../shared/misc/Utils'
import Sprite from './GuiSprite'


let DatConfig = {
  Entity: {
    exclude: [`systems`, `ecs`, `map`]
  }
}

class Manager {
  private scriptHiddenWidgets = new WeakMap<GuiWidget, boolean>()
  declare gameEngine: GameEngine
  declare sprites: Map<string, Sprite>
  declare widgets: Map<string, GuiWidget>
  declare currentWindow: GuiWidget | undefined
  declare rootWidget: GuiWidget | undefined
  declare mouseElement: HTMLElement | null | undefined
  declare datGui: DebugGui

  /**
   *
   * @param engine
   */
  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine
    this.sprites = new Map()

    this.widgets = new Map()
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async loadAssets() {
    //await this.generateAssets()

    let assetPath = AGate.getAppPath(`gui`)
    let assetLoader = this.gameEngine.assetLoader

    let guiMeta = await assetLoader.loadJsonFile(`${assetPath}/gui-images.json`) as Record<string, unknown[]>

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

    if (Utils.isFileExist(targetCss)) {
      return
    }

    let assetLoader = this.gameEngine.assetLoader
    let guiPath = AGate.getAppPath(`Interface`)

    let files = await assetLoader.findFiles(guiPath, `.json`) as string[]

    const descriptors: AssetDescriptor[] = []
    for (let i = 0; i < files.length; i++) {
      let jsonFile = files[i]

      let dotPos = jsonFile.lastIndexOf(`.`)
      let imageFile = jsonFile.substr(0, dotPos)

      let slashPos = jsonFile.lastIndexOf(`/`)
      let key = jsonFile.substring(slashPos + 1, dotPos)

      descriptors.push({
        key,
        type: `atlas`,
        texture: Utils.isFileExist(`${imageFile}.gif`) ? `${imageFile}.gif` : `${imageFile}.png`,
        data: jsonFile,
        output: `base64`
      })
    }

    let json: Record<string, GuiFrame[]> = {}
    let css = ``

    await assetLoader.loadAssets(descriptors, (descriptor: AssetDescriptor) => {
      // generate css
      let className = Utils.kebabCase(descriptor.key)
      css += `.${className} {background-image: url('${descriptor.image}');}\n`

      // generate json
      let frames = [] as unknown as GuiFrame[] & Record<string, GuiFrame>
      let jsonFrames = (descriptor.meta as SpritesheetData).frames
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

  /*loadImage(path) {
    let assetLoader = this.engine.assetLoader
    assetLoader.loadAsset({
      key,
      type: `atlas`,
      texture: [`${path}.gif`, `${path}.png`],
      data: jsonFile,
      output: `base64`
    })
  }*/

  /**
   *
   * @param key
   * @returns {*}
   */
  getSprite(key: string) {
    //key = AGate.Utils.kebabCase(key);
    let sprite = this.sprites.get(key)
    if (sprite) {
      return sprite
    }

    sprite = Sprite.fromUrl(key + `.gif`)
    this.sprites.set(key, sprite)
    return sprite
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
  addWidget(widget: GuiWidget) {
    console.debug(`Adding widget ${widget.get(`widget.id`)}`)
    this.widgets.set(widget.get(`widget.id`), widget)
  }

  /**
   *
   * @param id
   * @param children
   * @returns {null}
   */
  findWidget(id: string, children: Map<string, GuiWidget> | null = null): GuiWidget | null {
    if (!children) {
      children = this.widgets
    }

    /*if (id == 'plugSlots')
      console.error('found', children)*/

    let widget = children.get(id)
    if (widget) {
      return widget
    }

    for (let [key, value] of children) {
      if (!value.children) continue

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
  bringWindowTop(window: GuiWidget) {
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
  setRootWidget(widget: GuiWidget) {
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
  onMouseMove(event: MouseEvent) {
    let element = this.getMouseElement()

    element!.style.top = `${event.pageY}px`
    element!.style.left = `${event.pageX}px`
  }

  /**
   *
   * @param key
   * @param index
   */
  setMouseSprite(key: string, index = 0) {
    /*let sprite = this.getSprite(key: string)

    if (!sprite) {
      return
    }

    let frame = sprite.getFrame(index)

    let element = this.getMouseElement()

    if (this.prevMouseClass) {
      element.removeClass()
    }

    element.classList.add(sprite.className)

    this.getRootWidget()
      .getElement()
      .css(`cursor`, element.css(`background-image`) + `, auto`)

    this.prevMouseClass = sprite.className*/
  }



  /**
   *
   * @param object
   * @param parent
   * @param maxDepth
   */
  addDatGui(object: object, parent?: DebugGui, maxDepth = 3) {
    if (!object) {
      return
    }

    if (Utils.isNil(parent)) {
      if (!Utils.isNil(this.datGui)) {
        this.datGui.destroy()
      }

      // dat.gui requires a DOM; loading the engine in Node must not create one.
      const dat = require(`dat.gui`)
      this.datGui = new dat.GUI()
    }

    //this.datGui.add(this, 'renderToTexture')
    parent = parent || this.datGui

    //parent.open();

    for (let key in object) {
      if (key.charAt(0) === `_` || key === `client`) {
        continue
      }

      let value = (object as Record<string, unknown>)[key]
      if (Utils.isNil(value)) {
        continue
      }

      if (value && typeof value === 'object') {
        if (maxDepth > 0) {
          let folder = parent.addFolder(key)
          this.addDatGui(value, folder, maxDepth - 1)
        }
      } else if (Utils.isArray(value)) {
      } else {
        if (!Utils.isFunction(value)) {
          parent.add(object, key)
        }
      }
    }
  }

  addEntityBubble(entity: Entity) {
    let dialogWin = this.findWidget('dialogWin')

    let { classes } = entity.visual!
    if (!classes) {
      return
    }

    let { sprite } = classes.current
    if (!sprite) {
      return
    }

    let position = sprite.getGlobalPosition()


    let model = dialogWin!.createChild({
      id: entity.id,
      type: `dialog-bubble`,
      position: [position.x, position.y],
      value: `${entity.id}`,
      options: {

      }
    })
  }

  setEntityVisibility(entity: Entity, visible: boolean): void {
    const widget = this.findWidget('dialogWin')?.getChild(entity.id)
    if (!widget) return
    if (!visible) {
      if (!this.scriptHiddenWidgets.has(widget)) this.scriptHiddenWidgets.set(widget, widget.get('widget.visible'))
      widget.hide()
    } else if (this.scriptHiddenWidgets.has(widget)) {
      if (this.scriptHiddenWidgets.get(widget)) widget.show()
      else widget.hide()
      this.scriptHiddenWidgets.delete(widget)
    }
  }

  updateEntityBubble(entity: Entity) {
    let dialogWin = this.findWidget('dialogWin')
    if (!dialogWin) {
      return
    }
    let widget = dialogWin.getChild(entity.id)
    if (!widget) {
      return
    }

    widget.update(entity)
  }



}

export default Manager
