// @flow

import Evaluator from './Evaluator'
import type Entity from '../../entity/Entity'

export default class extends Evaluator {
  constructor(options) {
    super(options)
  }

  onCommand(command: Object) {
    super.onCommand(command)

    let {entity} = command

    lll(entity)
    let result = this[`handle${entity.base.type}`](entity)
  }

  handleNpc(entity: Entity) {
    lll(entity)
  }

  handleWall(entity: Entity) {
    lll(entity)
  }

  handlePortal(entity: Entity) {
    lll(entity)
  }
}
