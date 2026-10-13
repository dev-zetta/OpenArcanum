import type { Filter as PixiFilter, Container } from 'pixi.js'
import type { AssetDescriptor } from '../shared/assets/AssetLoader'
interface ShaderDescriptor { key?: string; shader?: PixiFilter; vertex?: string; fragment?: string }
interface EngineShader extends PixiFilter { uniforms?: { iTime: number; iResolution: number[]; iMouse: number[]; iWorldPosition: number[] } }
import type ClientEngine from './ClientEngine'

import PixiRenderer from './render/pixi/PixiRenderer'

import Utils from '../shared/misc/Utils'
import { Filter } from './render/Filter'

export default class Renderer extends PixiRenderer {
  declare gameEngine: (ClientEngine)["gameEngine"]

  declare shaders: Record<string, ShaderDescriptor>


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

  update(time: number, delta: number) {
    super.update(time, delta)

    for (let key in this.shaders) {
      let shader = this.shaders[key]
      if (shader.shader) {
        this.updateShader(shader.shader)
      }
    }
  }

  onDisplayObjectClick(object: Container & { data?: unknown }) {
    super.onDisplayObjectClick(object)

    let sprite = object.data

    this.gameEngine.events.emit(`Object:Click`, sprite)
  }

  /**
   *
   * @param name
   * @returns {*}
   */
  getShader(name: string): PixiFilter {
    let descriptor = this.shaders[name]

    if (!descriptor) {
      let shader = this.newFilter(name)
      descriptor = { shader }
        this.shaders[name] = descriptor
      return shader
    }

    if (!descriptor.shader) {
      descriptor.shader = new Filter(descriptor.vertex!, descriptor.fragment!)
    }

    return descriptor.shader
  }

  bindShader(shader: PixiFilter, update = true) {
    if (update) {
      this.updateShader(shader)
    }

    if (!this.stage.filters) {
      this.stage.filters = []
    }

    (this.stage.filters as PixiFilter[]).push(shader)
  }

  updateShader(shader: EngineShader) {
    // Only our custom filters use the Shadertoy-style engine uniforms.
    // Pixi's built-in filters manage their own uniform groups.
    if (!shader.uniforms || !('iTime' in shader.uniforms)) return
    let screen = this.renderer.screen
    shader.uniforms[`iResolution`] = [screen.width, screen.height]
    shader.uniforms[`iTime`] = this.lastTimestamp / 1000

    const { global } = this.renderer.events.pointer

    const { position } = this.stage
    shader.uniforms[`iMouse`] = [global.x, global.y]
    shader.uniforms[`iWorldPosition`] = [position.x, position.y]
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
    if (!this.gameEngine.assetLoader.isFileExists(dataUrl)) return []
    let files = await this.gameEngine.assetLoader.findFiles(
      dataUrl,
      `.fragment.glsl`
    ) as string[]

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
      this.shaders[descriptor!.key] = descriptor!
    }

    return descriptors
  }
}
