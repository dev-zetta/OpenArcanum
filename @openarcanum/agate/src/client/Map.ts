import GameMap from '../shared/map/GameMap';

import type { Container } from 'pixi.js'
export default class Map extends GameMap {
  declare rootGroup: Container
  declare litGroup: Container
  declare tileGroup: Container
  declare objectGroup: Container

}
