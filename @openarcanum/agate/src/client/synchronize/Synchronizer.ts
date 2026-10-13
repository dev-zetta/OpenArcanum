import type ClientNetwork from '../network/ClientNetwork'
import type { SyncOptions } from './LegacySyncTypes'
import InterpolateStrategy from './syncStrategies/InterpolateStrategy'
import ExtrapolateStrategy from './syncStrategies/ExtrapolateStrategy'
import FrameSyncStrategy from './syncStrategies/FrameSyncStrategy'

const strategies = {
  extrapolate: ExtrapolateStrategy,
  interpolate: InterpolateStrategy,
  frameSync: FrameSyncStrategy
}

export default class Synchronizer {
  declare clientEngine: ClientNetwork
  declare options: SyncOptions
  declare syncStrategy: InterpolateStrategy | ExtrapolateStrategy | FrameSyncStrategy

  // create a synchronizer instance
  constructor(clientEngine: ClientNetwork, options: SyncOptions) {
    this.clientEngine = clientEngine
    this.options = options || {}
    if (!strategies.hasOwnProperty(this.options.sync!)) {
      throw new Error(
        `ERROR: unknown synchronzation strategy ${this.options.sync}`
      )
    }
    this.syncStrategy = new strategies[this.options.sync as keyof typeof strategies](
      this.clientEngine,
      this.options
    )
  }
}
