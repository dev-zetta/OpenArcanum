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

    lll(`handle${entity.base.type}`, entity)
    let result = this[`handle${entity.base.type}`](entity)

    return this.result('test', {})
  }

  handlePc(entity: Entity) {

  }

  handleNpc(entity: Entity) {

  }

  handleWall(entity: Entity) {
    lll(entity)
  }

  handlePortal(entity: Entity) {
    lll(entity)
  }

  handleScenery(entity: Entity) {
    lll(entity)
  }

  handleContainer(entity: Entity) {
    lll(entity)
  }
}
