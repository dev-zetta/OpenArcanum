/* global AGate */

import { Sector } from './map/Sector'
import { Location } from './Location'
import { Math } from './misc/Math'

// https://github.com/qiao/PathFinding.js
const PF = AGate.requireNode('pathfinding')

export class PathFind {
  constructor(map) {
    this.map = map

    this.finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true
      // heuristic: PF.Heuristic.chebyshev
    })
  }

  async findPath(start, end) {
    return new Promise(resolve => {
      let map = this.map

      console.log(`${start} - ${end}`)

      let distance = Location.calculateDistance(start, end)
      let range = distance + Math.round(distance / 2)

      let tilesX = map.width * Sector.Width
      let tilesY = map.height * Sector.Height

      let reversed = start[0] > end[0] || start[1] > end[1]
      if (reversed) {
        let t = start
        start = end
        end = t
      }

      let startX = start[0] - range
      let startY = start[1] - range

      if (startX < 0) {startX = 0}

      if (startY < 0) {startY = 0}

      let endX = end[0] + range
      let endY = end[1] + range

      if (endX >= tilesX) {endX = tilesX - 1}

      if (endY >= tilesY) {endY = tilesY - 1}

      //console.log(Math.abs(endX - startX) + 1, Math.abs(endY - startY) + 1)
      let width = Math.abs(endX - startX) + 1
      let height = Math.abs(endY - startY) + 1
      this.grid = new PF.Grid(width, height)

      // Set blocked tiles to the grid
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (map.isTileBlocked(x, y)) {
            this.grid.setWalkableAt(x - startX, y - startY, false)
          }
        }
      }

      //console.log(start, end);
      //console.log(start[0] - startX, start[1] - startY, end[0] - startX, end[1] - startY);

      let path = this.finder.findPath(
        start[0] - startX,
        start[1] - startY,
        end[0] - startX,
        end[1] - startY, // start[0] % width, start[1] % height, end[0] % width, end[1] % height
        this.grid
      )

      if (reversed) {
        path.reverse()
      }

      for (let point of path) {
        point[0] += startX
        point[1] += startY
      }

      console.log('Found', path)
      resolve(path)
    })
  }
}
