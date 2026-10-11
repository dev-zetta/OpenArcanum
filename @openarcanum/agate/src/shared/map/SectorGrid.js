// @flow
import Sector from './Sector'
import SectorCache from './SectorCache'
import GameMap from './GameMap'

export class SectorGrid {
  map: GameMap
  sectors: Array<Array<Sector>>
  sectorsInGrid: Array<Sector>

  cache: SectorCache
  rangeTopLeft: Array<number>
  rangeBottomRight: Array<number>

  rangeSubX: number
  rangeSubY: number

  static get GridWidth() {
    return 3
  }
  static get GridHeight() {
    return 3
  }

  /**
   *
   */
  constructor(map: GameMap) {
    this.cache = new SectorCache(map)
    this.map = map

    this.clear()

    const gw = SectorGrid.GridWidth / 2.0
    const gh = SectorGrid.GridHeight / 2.0
    this.rangeSubX = Math.floor(gw)
    this.rangeSubY = Math.floor(gh)
  }

  /**
   *
   * @param x
   * @param y
   * @returns {*}
   */
  get(x: number, y: number): Sector {
    const xi = x - this.rangeTopLeft[0]
    const yi = y - this.rangeTopLeft[1]

    if (xi >= 0 && yi >= 0 && xi < SectorGrid.GridWidth && yi < SectorGrid.GridHeight) {
      return this.sectors[yi][xi]
    } else {
      return this.cache.get(x, y)
    }
  }

  /**
   *
   * @param width
   * @param height
   */
  create(width: number, height: number) {
    this.sectors = new Array(width)

    for (let i = 0; i < width; i++) {
      this.sectors[i] = new Array(height)
    }
  }

  /**
   *
   * @param sector
   */
  add(sector: Sector) {
    const {x, y} = sector
    this.sectors[y][x] = sector
    this.cache.add(sector)
  }

  getAll(): Array<Sector> {
    return this.sectorsInGrid
  }

  /**
   *
   * @param x = center
   * @param y = center
   * @returns {Promise<void>}
   */
  async load(x: number, y: number) {
    x -= this.rangeSubX
    y -= this.rangeSubY

    const map = this.map

    let xc = x + SectorGrid.GridWidth
    let yc = y + SectorGrid.GridHeight

    this.rangeTopLeft = [x, y]
    this.rangeBottomRight = [xc, yc]
    this.sectorsInGrid = []

    lll(`Grid: Loading sectors`, x, xc, y, yc)

    let promises = []
    for (let col = y; col < yc; col++) {
      for (let row = x; row < xc; row++) {
        const isOutside = (col < 0) || (row < 0) || (row >= map.width) || (col >= map.height)

        let sector = null

        if (!isOutside) {
          sector = this.cache.get(row, col)
          if (!sector) {
            sector = await map.loadSector(row, col)
            if (sector) {
              this.cache.add(sector)
              lll('Adding sector to cache')
            } else {
              lll(`Unable to load sector`, row, col)
            }
          } else {
            lll('Using cached sector')
          }
        } else {
          lll(`Grid: Is outside`, row, col)
        }

        if (sector) {
          this.sectorsInGrid.push(sector)
        }

        this.sectors[col - y][row - x] = sector
        //promises.push(map.loadSector(row, col))
      }
    }

    lll('sectorsInGrid', this.sectorsInGrid)

    //await Promise.all(promises)
  }

  /**
   *
   */
  clear() {
    this.cache.clear()
    this.create(SectorGrid.GridWidth, SectorGrid.GridHeight)
    this.rangeTopLeft = [0, 0]
    this.rangeBottomRight = [0, 0]
    this.sectorsInGrid = []
  }
}
