import GameWorld from '../shared/GameWorld'
import GameMap from './Map'
import Player from './Player'
import type GameEngine from '../shared/GameEngine'

export default class World extends GameWorld {
  players: Map<string, Player>

  playerCount: number

  syncCounter: number
  requestImmediateSync: boolean
  requestFullSync: boolean

  /**
   *
   * @param gameEngine
   * @param settings
   */
  constructor(gameEngine: GameEngine, settings: Object) {
    super(gameEngine, settings)
    this.players = new Map()

    this.syncCounter = 0
    this.requestImmediateSync = false
    this.requestFullSync = false

    this.playerCount = 0
  }

  /**
   *
   * @param id
   * @returns {Player}
   */
  getPlayer(id: string): ?Player {
    return this.players.get(id)
  }

  /**
   *
   * @param options
   * @returns {GameMap}
   */
  mapFactory(options: Object): GameMap {
    return new GameMap(this, options)
  }
}
