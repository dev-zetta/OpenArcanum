// @flow
import type GameMap from './GameMap'
import Sector from './Sector'

const LRU = require(`lru-cache`)
// https://www.npmjs.com/package/lru-cache

export default class Cache extends LRU {
  map: GameMap

  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    const options = {
      max: 500,
      length: function(n, key) {
        return n * 2 + key.length
      },
      dispose: function(key, n) {
        n.close()
      },
      maxAge: 1000 * 60 * 60
    }

    super(options)

    this.map = map
  }

  /**
   *
   * @param sector
   */
  add(sector: Sector) {
    this.set(sector, sector.id)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  get(x: any, y: number): Sector {
    let id = typeof y === `undefined` ? x : Sector.makeId((x: number), y)
    return super.get(id)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  has(x: any, y: number) {
    let id = typeof y === `undefined` ? x : Sector.makeId((x: number), y)
    return super.has(id)
  }


}
