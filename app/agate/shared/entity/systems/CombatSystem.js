/* global AGate */

import { System } from '../System'
import { Location } from '../../Location'
import Enums from '../../enums'

export class CombatSystem extends System {
  test(entity) {
    return !!entity.npc
  }

  enter(entity) {}

  update(entity, elapsed) {}

  exit(entity) {}

  async moveToLocation(entity, location) {}
}
