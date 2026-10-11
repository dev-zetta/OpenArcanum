// @flow

import Sector from './Sector'
import Location from '../Location'
import Math from '../misc/Math'

// https://github.com/qiao/PathFinding.js
const PF = require(`pathfinding`)

export default class PathFind {
  /**
   *
   * @param map
   */
  constructor(map: GameMap) {
    this.map = map

    this.finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true,
      heuristic: PF.Heuristic.chebyshev
    })
  }

  async findPathAsync(start: Location, end: Location): Promise<*> {
    return this.findPath(start, end)
  }

  /**
   *
   * @param start
   * @param end
   */
  findPath(start: Location, end: Location) {
    const map = this.map
    const tilesX = map.width * Sector.Width
    const tilesY = map.height * Sector.Height
    if (![start.x, start.y, end.x, end.y].every(Number.isInteger) ||
        start.x < 0 || start.y < 0 || end.x < 0 || end.y < 0 ||
        start.x >= tilesX || end.x >= tilesX || start.y >= tilesY || end.y >= tilesY ||
        map.isTileBlocked(end.x, end.y)) return []

    // Cover both directions and every boundary cell. Empty/unloaded tiles remain
    // blocked; an object click must never force a wall or void to be walkable.
    const range = Math.max(8, Math.ceil(start.distanceTo(end) / 2))
    const startX = Math.max(0, Math.min(start.x, end.x) - range)
    const startY = Math.max(0, Math.min(start.y, end.y) - range)
    const endX = Math.min(tilesX - 1, Math.max(start.x, end.x) + range)
    const endY = Math.min(tilesY - 1, Math.max(start.y, end.y) + range)
    this.grid = new PF.Grid(endX - startX + 1, endY - startY + 1)
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        this.grid.setWalkableAt(x - startX, y - startY, !map.isTileBlocked(x, y))
      }
    }
    this.grid.setWalkableAt(start.x - startX, start.y - startY, true)
    return this.finder.findPath(start.x - startX, start.y - startY,
      end.x - startX, end.y - startY, this.grid)
      .map(point => new Location(point[0] + startX, point[1] + startY))
  }
}
