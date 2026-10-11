// @flow
import type GameMap from './GameMap'
import Sector from './Sector'

import { LRUCache } from 'lru-cache'
// https://www.npmjs.com/package/lru-cache

export default class Cache extends LRUCache {
  map: GameMap

  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    const options = {
      max: 500,
      ttl: 1000 * 60 * 60
    }

    super(options)

    this.map = map
  }

  /**
   *
   * @param sector
   */
  add(sector: Sector) {
    this.set(sector.id, sector)
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
