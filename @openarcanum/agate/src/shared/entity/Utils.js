// @flow

import type Entity from './Entity';

class EntityUtils {
  static canSpeak(entity: Entity): boolean {
    return !!entity.critter
  }

  /**
   *
   * @param entity
   * @returns {*}
   */
  static isDynamic(entity: Entity): boolean {
    return entity.critter || entity.projectile
  }

}

export default EntityUtils
