// @flow

import Evaluator from './Evaluator'
import type Entity from '../../entity/Entity'

export default class extends Evaluator {
  constructor(options) {
    super(options)
  }

  onCommand(command: Object) {
    super.onCommand(command)

    let {tile} = command

    this.checkMapLocation(tile)

    return this.result('MoveToLocation', tile.location)

  }

  checkMapLocation(tile) {
    if (tile.blocked) {

    }

  }
}
