// @flow
/* global AGate */

import System from '../System'
import type Location from '../../Location'
import * as Enums from '../../enums'
import type Entity from '../Entity';
import Utils from '../../misc/Utils'

export default class Combat extends System {

  /**
   *
   * @param entity
   * @returns {boolean}
   */
  test(entity: Entity) {
    return !!entity.critter
  }

  /**
   *
   * @param entity
   */
  enter(entity: Entity) {}

  /**
   *
   * @param entity
   * @param elapsed
   */
  update(entity: Entity, elapsed: number) {
    super.update(entity, elapsed)
  }

  /**
   *
   * @param entity
   */
  exit(entity: Entity) {}

  /**
   *
   * @param entity
   * @param location
   * @returns {Promise<void>}
   */
  moveToLocation(entity: Entity, location: Location) {}
}
