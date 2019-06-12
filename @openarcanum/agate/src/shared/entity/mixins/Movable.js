// @flow

import type MovementPath from '../MovementPath';

const Mixin = (superclass) =>
  class extends superclass {
    movementPath: MovementPath

    constructor() {
      super()

      this.movementPath = new MovementPath()
    }

    foo() {
      console.log(`foo from Mixin1`)
      if (super.foo) super.foo()
    }
  }

  export default Mixin
