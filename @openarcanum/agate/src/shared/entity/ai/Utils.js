import Utils from '../../misc/Utils';

export function didTargetEntityMove(entity) {
  return !entity.critter.movementPath.isTargetSame(
    entity.state.targetEntity.base.location
  )
}

export function scorer(value) {
  return function(target, property, descriptor) {
    console.log(target, property, descriptor, c)

    const original = descriptor.value // hold onto the original function

    //save mapping reference as static property to target class
    target[`constructor`][`Scorers`] = target[`constructor`][`Scorers`] || []
    target[`constructor`][`Scorers`].push(descriptor.value)

    descriptor.value.name = property

    if (typeof original === `function`) {
      //ensure that it is a function
      // substitute a new function for the original, this is what will be called instead
      descriptor.value = function(...args) {
        const result = original.apply(this, args) // call the now-wrapped original
        console.log(`${name}(${args}) = ${result}`)
      }
    }
    return target
  }
}

const errorHandler = (target, property, descriptor) => {
  const original = descriptor.value
  if (typeof original === `function`) {
    descriptor.value = async function(...args) {
      try {
        return await original.apply(this, args)
      } catch (e) {
        console.error(`error from the decorator`, e)
      }
    }
  }
}

export class Interval {
  constructor(seconds) {
    this.interval = seconds * 1000.0
    this.lastTime = 0

  }

  start() {
    this.lastTime = Utils.getCurrentTimestamp()
  }

  hit() {
    let now = Utils.getCurrentTimestamp()
    if (this.lastTime === 0) {
      this.lastTime = now
      return false
    }

    if (now - this.lastTime >= this.interval) {
      this.lastTime = now
      return true
    }

    return false
  }


}
