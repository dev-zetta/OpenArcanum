// @flow

import type Entity from '../Entity';

export default class Component {
  entity: Entity

  /**
   *
   * @param entity
   */
  constructor(entity: Entity) {
    this.entity = entity
  }


}
