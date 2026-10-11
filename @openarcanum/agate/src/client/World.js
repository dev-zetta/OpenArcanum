import GameWorld from '../shared/GameWorld'
import GameMap from './Map';

export default class World extends GameWorld {
  /**
   *
   * @param options
   * @returns {GameMap}
   */
  mapFactory(options: Object): GameMap {
    return new GameMap(this, options)
  }
}
