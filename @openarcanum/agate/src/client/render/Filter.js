import PIXI from '../libs/PIXI'

const header_fragment = require(`./shaders/header.fragment.glsl`)
const default_fragment = require(`./shaders/default.fragment.glsl`)

const header_vertex = require(`./shaders/header.vertex.glsl`)
const default_vertex = require(`./shaders/default.vertex.glsl`)

export class Filter extends PIXI.Filter {
  /**
   *
   * @param game
   * @param fragShader
   * @param vertShader
   */
  constructor(vertShader, fragShader) {
    vertShader = vertShader.replace(`#include default`, default_vertex)
    vertShader = vertShader.replace(`#include header`, header_vertex)

    fragShader = fragShader.replace(`#include header`, header_fragment)
    fragShader = fragShader.replace(`#include default`, default_fragment)

    //const program = new PIXI.Program(vertShader, fragShader)

    //super(program)
    super(vertShader, fragShader)
  }
}
