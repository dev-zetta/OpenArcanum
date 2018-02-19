import AGate from '../agate';
import {Sector} from './Sector';

// https://github.com/qiao/PathFinding.js
const PF = AGate.requireNode('pathfinding');

export class PathFind {
  constructor(map) {
    this.map = map;

    this.finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true,
      // heuristic: PF.Heuristic.chebyshev
    });
  }

  async findPath(start, end) {
    return new Promise(resolve => {
      let map = this.map;

      this.grid = new PF.Grid(map.width * Sector.Width, map.height *
        Sector.Height);

      // Set blocked tiles to the grid
      for (let col = 0; col < map.height; col++) {

        for (let row = 0; row < map.width; row++) {
          let sector = map.sectors[col][row];

          for (let y = 0; y < Sector.Height; y++) {
            for (let x = 0; x < Sector.Width; x++) {
              if (sector.isTileBlocked(x, y)) {
                this.grid.setWalkableAt((row * Sector.Width) + x, (col *
                  Sector.Height) + y, false);
              }

            }
          }

        }
      }

      let path = this.finder.findPath(start[0], start[1], end[0], end[1],
        this.grid);

      resolve(path);
    });
  }



}
