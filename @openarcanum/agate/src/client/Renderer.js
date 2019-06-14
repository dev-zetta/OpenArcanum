// @flow
import BaseRenderer from './render/BaseRenderer'
import type GameEngine from '../shared/GameEngine';
import type ClientEngine from './ClientEngine';

export default class Renderer extends BaseRenderer {
  /**
   *
   * @param gameEngine
   * @param clientEngine
   */
  constructor(gameEngine: GameEngine, clientEngine: ClientEngine) {
    super(gameEngine, clientEngine)
    this.sprites = {}
  }

  /**
   *
   * @param t
   * @param dt
   */
  draw(t: number, dt: number) {
    super.draw(t, dt)
  }
}
