import Lance from '../libs/lance'

export class Renderer extends Lance.Renderer {
  /**
   *
   * @param gameEngine
   * @param clientEngine
   */
  constructor(gameEngine, clientEngine) {
    super(gameEngine, clientEngine)
    this.sprites = {}
  }

  /**
   *
   * @param t
   * @param dt
   */
  draw(t, dt) {
    super.draw(t, dt)
  }
}
