// @flow

import PixiRenderer from './render/pixi/PixiRenderer'
import type ClientEngine from './ClientEngine'
import Utils from '../shared/misc/Utils'
import { Pipeline } from './render/pipeline'

export default class Renderer extends PixiRenderer {
  shaders: Object

  /**
   *
   * @param clientEngine
   */
  constructor(clientEngine: ClientEngine) {
    super(clientEngine)

    this.engine = clientEngine.engine
    this.shaders = {}
  }

  async init() {
    await super.init()
  }


  /**
   *
   * @param t
   * @param dt
   */
  draw(t: number, dt: number) {
    super.draw(t, dt)
  }


  onDisplayObjectClick(object) {
    super.onDisplayObjectClick(object)

    let sprite = object.data

    this.engine.events.emit('Object:Click', sprite)
  }

  addPipeline(name: string, pipeline: Pipeline) {}

  /**
   *
   * @param name
   * @returns {*}
   */
  getShader(name: string): Object {
    let descriptor = this.shaders[name]
    if (!descriptor.pipeline) {
      descriptor.pipeline = this.addPipeline(
        name,
        new Pipeline(this.game, descriptor.vertex, descriptor.fragment)
      )
    }

    return descriptor
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
    let files = await this.engine.assetLoader.findFiles(
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

    return Promise.all(promises)
  }
}
