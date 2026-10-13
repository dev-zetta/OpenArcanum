import type Entity from '../../../shared/entity/Entity'
import type ClientEngine from '../../ClientEngine'

import Evaluator from './Evaluator'

export default class extends Evaluator {

  constructor(options: { engine: ClientEngine }) {
    super(options)
  }

  onCommand(command: Record<string, unknown>) {
    super.onCommand(command)

    let entity = command.entity as Entity

    lll(`handle${entity.base.type}`, entity)
    let result = this[`handle${entity.base.type}` as 'handlePc' | 'handleNpc' | 'handleWall' | 'handlePortal' | 'handleScenery' | 'handleContainer'](entity)

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
