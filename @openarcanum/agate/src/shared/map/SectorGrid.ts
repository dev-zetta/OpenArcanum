import SectorCache from './SectorCache'

export interface GridSector { id: string; x: number; y: number }
export interface GridMap<Value extends GridSector = GridSector> {
  width: number
  height: number
  loadSector(x: number, y: number): Promise<Value | null | undefined>
}
interface GridCache<Value extends GridSector> {
  get(x: number, y: number): Value | undefined
  add(sector: Value): void
  clear(): void
}

export class SectorGrid<Value extends GridSector = GridSector> {
  declare map: GridMap<Value>
  sectors: (Value | null | undefined)[][] = []
  sectorsInGrid: Value[] = []
  declare cache: GridCache<Value>
  rangeTopLeft: [number, number] = [0, 0]
  rangeBottomRight: [number, number] = [0, 0]
  declare rangeSubX: number
  declare rangeSubY: number

  static get GridWidth(): number { return 3 }
  static get GridHeight(): number { return 3 }

  constructor(map: GridMap<Value>) {
    // The LRU cache stores the sectors loaded by this map.
    this.cache = new SectorCache<Value>(map)
    this.map = map
    this.clear()
    this.rangeSubX = Math.floor(SectorGrid.GridWidth / 2.0)
    this.rangeSubY = Math.floor(SectorGrid.GridHeight / 2.0)
  }

  get(x: number, y: number): Value | null | undefined {
    const xi = x - this.rangeTopLeft[0]
    const yi = y - this.rangeTopLeft[1]
    return xi >= 0 && yi >= 0 && xi < SectorGrid.GridWidth && yi < SectorGrid.GridHeight ?
      this.sectors[yi]![xi] : this.cache.get(x, y)
  }

  create(width: number, height: number): void {
    this.sectors = new Array(width)
    for (let i = 0; i < width; i++) this.sectors[i] = new Array(height)
  }

  add(sector: Value): void {
    const { x, y } = sector
    this.sectors[y]![x] = sector
    this.cache.add(sector)
  }

  getAll(): Value[] { return this.sectorsInGrid }

  async load(x: number, y: number): Promise<void> {
    x -= this.rangeSubX
    y -= this.rangeSubY
    const map = this.map
    const xc = x + SectorGrid.GridWidth
    const yc = y + SectorGrid.GridHeight
    this.rangeTopLeft = [x, y]
    this.rangeBottomRight = [xc, yc]
    this.sectorsInGrid = []
    lll('Grid: Loading sectors', x, xc, y, yc)
    for (let col = y; col < yc; col++) {
      for (let row = x; row < xc; row++) {
        const isOutside = col < 0 || row < 0 || row >= map.width || col >= map.height
        let sector: Value | null | undefined = null
        if (!isOutside) {
          sector = this.cache.get(row, col)
          if (!sector) {
            sector = await map.loadSector(row, col)
            if (sector) {
              this.cache.add(sector)
              lll('Adding sector to cache')
            } else {
              lll('Unable to load sector', row, col)
            }
          } else {
            lll('Using cached sector')
          }
        } else {
          lll('Grid: Is outside', row, col)
        }
        if (sector) this.sectorsInGrid.push(sector)
        this.sectors[col - y]![row - x] = sector
      }
    }
    lll('sectorsInGrid', this.sectorsInGrid)
  }

  clear(): void {
    this.cache.clear()
    this.create(SectorGrid.GridWidth, SectorGrid.GridHeight)
    this.rangeTopLeft = [0, 0]
    this.rangeBottomRight = [0, 0]
    this.sectorsInGrid = []
  }
}
