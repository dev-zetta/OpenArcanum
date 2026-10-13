import { LRUCache } from 'lru-cache'
import Sector from './Sector'
import type { GridMap, GridSector } from './SectorGrid'

export default class Cache<Value extends GridSector = Sector> extends LRUCache<string, Value> {
  declare map: GridMap<Value>
  constructor(map: GridMap<Value>) {
    super({ max: 500, ttl: 1000 * 60 * 60 })
    this.map = map
  }
  add(sector: Value): void { this.set(sector.id, sector) }
  get(key: string, options?: Parameters<LRUCache<string, Value>['get']>[1]): Value | undefined
  get(x: number, y: number): Value | undefined
  get(x: string | number, y?: number | Parameters<LRUCache<string, Value>['get']>[1]): Value | undefined {
    return super.get(typeof y === 'number' ? Sector.makeId(Number(x), y) : String(x), typeof y === 'object' ? y : undefined)
  }
  has(key: string, options?: Parameters<LRUCache<string, Value>['has']>[1]): boolean
  has(x: number, y: number): boolean
  has(x: string | number, y?: number | Parameters<LRUCache<string, Value>['has']>[1]): boolean {
    return super.has(typeof y === 'number' ? Sector.makeId(Number(x), y) : String(x), typeof y === 'object' ? y : undefined)
  }
}
