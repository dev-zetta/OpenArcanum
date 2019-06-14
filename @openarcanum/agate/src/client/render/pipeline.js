import Phaser from '../../libs/Phaser'

const header_fragment = require(`./pipelines/header.fragment.glsl`)
const default_fragment = require(`./pipelines/default.fragment.glsl`)

const header_vertex = require(`./pipelines/header.vertex.glsl`)
const default_vertex = require(`./pipelines/default.vertex.glsl`)

export class Pipeline extends Phaser.Renderer.WebGL.Pipelines
  .TextureTintPipeline {
  /**
   *
   * @param game
   * @param fragShader
   * @param vertShader
   */
  constructor(game, vertShader, fragShader) {
    vertShader = vertShader.replace(`#include default`, default_vertex)
    vertShader = vertShader.replace(`#include header`, header_vertex)

    fragShader = fragShader.replace(`#include header`, header_fragment)
    fragShader = fragShader.replace(`#include default`, default_fragment)

    //console.log(fragShader, vertShader)

    super({
      game,
      renderer: game.renderer,
      fragShader,
      vertShader
    })
  }
}
