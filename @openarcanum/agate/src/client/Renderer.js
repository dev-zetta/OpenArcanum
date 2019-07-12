// @flow

import PixiRenderer from './render/pixi/PixiRenderer'
import type ClientEngine from './ClientEngine'
import Utils from '../shared/misc/Utils'
import { Filter } from './render/Filter'

export default class Renderer extends PixiRenderer {
  shaders: Object

  /**
   *
   * @param clientEngine
   */
  constructor(clientEngine: ClientEngine) {
    super(clientEngine)

    this.gameEngine = clientEngine.gameEngine
    this.shaders = {}

  }

  async init() {
    await super.init()
    await this.loadShaders()
  }

  /**
   *
   * @param t
   * @param dt
   */
  draw(t: number, dt: number) {
    super.draw(t, dt)
  }

  update(time, delta) {
    super.update(time, delta)

    for (let key in this.shaders) {
      let shader = this.shaders[key]
      if (shader.shader) {
        this.updateShader(shader.shader)
      }
    }
  }

  onDisplayObjectClick(object) {
    super.onDisplayObjectClick(object)

    let sprite = object.data

    this.gameEngine.events.emit(`Object:Click`, sprite)
  }


  /**
   *
   * @param name
   * @returns {*}
   */
  getShader(name: string): Object {
    let descriptor = this.shaders[name]


    if (!descriptor.shader) {
      descriptor.shader = new Filter(descriptor.vertex, descriptor.fragment)
    }

    return descriptor.shader
  }

  bindShader(shader, update = true) {
    if (update) {
      this.updateShader(shader)
    }

    this.stage.filters = [shader]
  }

  updateShader(shader) {
    let screen = this.renderer.screen
    shader.uniforms[`iResolution`] = [screen.width, screen.height]
    shader.uniforms[`iTime`] = this.lastTimestamp / 1000
  }

  /**
   *
   * @param name
   * @returns {Promise<void>}
   */
  async loadShader(name: string) {
    let dataUrl = AGate.getAppPath(`shader`)
    return this.clientEngine.loadAsset(name, `shader`, {
      fragment: `${dataUrl}/${name}.fragment.glsl`,
      vertex: `${dataUrl}/${name}.vertex.glsl`
    })
  }

  async loadShaders() {
    let dataUrl = AGate.getAppPath(`shader`)
    let files = await this.gameEngine.assetLoader.findFiles(
      dataUrl,
      `.fragment.glsl`
    )

    let promises = []
    for (let file of files) {
      let path = file.replace(`.fragment.glsl`, ``)
      let name = Utils.getFileName(path)

      promises.push(
        this.clientEngine.loadAsset(name, `shader`, {
          fragment: file,
          vertex: path + `.vertex.glsl`
        })
      )
    }

    let descriptors = await Promise.all(promises)
    for (let descriptor of descriptors) {
      //lle('loading shader', descriptor.key, descriptor)
      this.shaders[descriptor.key] = descriptor
    }

    return descriptors
  }


}
