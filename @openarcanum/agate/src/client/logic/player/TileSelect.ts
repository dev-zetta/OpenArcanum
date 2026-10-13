import type ClientEngine from '../../ClientEngine'

import Evaluator from './Evaluator'

export default class extends Evaluator {
  constructor(options: { engine: ClientEngine }) {
    super(options)
  }

  onCommand(command: Record<string, unknown>) {
    super.onCommand(command)

    let tile = command.tile as { location: unknown }

    if (this.checkMapLocation(tile)) {

    }

    return this.result('MoveToLocation', tile.location)

  }

  checkMapLocation(tile: unknown): boolean | undefined {
    this.gameEngine.world
    return undefined

  }
}
