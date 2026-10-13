import type GameEngine from '../shared/GameEngine'

import GameWorld from '../shared/GameWorld'
import GameMap from './Map'
import Player from './Player'

export default class World extends GameWorld {
  declare players: Map<string, Player>
  declare playerCount: number
  declare syncCounter: number
  declare requestImmediateSync: boolean
  declare requestFullSync: boolean


  /**
   *
   * @param gameEngine
   * @param settings
   */
  constructor(gameEngine: GameEngine, settings: Record<string, unknown>) {
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
  getPlayer(id: string): Player | null | undefined {
    return this.players.get(id)
  }

  /**
   *
   * @param options
   * @returns {GameMap}
   */
  mapFactory(options: Record<string, unknown>): GameMap {
    const id = typeof options.id === 'string' ? options.id : 'default'
    return new GameMap(this, id)
  }
}
