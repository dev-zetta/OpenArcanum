import type { CollisionOptions, PhysicsGameEngine, PhysicsObject } from '../PhysicsTypes'
import HSHG from './HSHG'

// Collision detection based on Hierarchical Spatial Hash Grid
// uses this implementation https://gist.github.com/kirbysayshi/1760774
class HSHGCollisionDetection {
  declare options: CollisionOptions
  declare gameEngine: PhysicsGameEngine
  declare grid: HSHG<PhysicsObject>
  declare previousCollisionPairs: Record<string, { o1: PhysicsObject; o2: PhysicsObject }>
  declare stepCollidingPairs: Record<string, { o1: PhysicsObject; o2: PhysicsObject }>

  constructor(options: CollisionOptions = {}) {
    this.options = Object.assign({COLLISION_DISTANCE: 28}, options)
  }

  init(options: { gameEngine: PhysicsGameEngine }) {
    this.gameEngine = options.gameEngine
    this.grid = new HSHG<PhysicsObject>()
    this.previousCollisionPairs = {}
    this.stepCollidingPairs = {}

    this.gameEngine.events.on(`objectAdded`, obj => {
      // add the gameEngine obj the the spatial grid
      this.grid.addObject(obj)
    })

    this.gameEngine.events.on(`objectDestroyed`, obj => {
      // add the gameEngine obj the the spatial grid
      this.grid.removeObject(obj)
    })
  }

  detect() {
    this.grid.update()
    this.stepCollidingPairs = this.grid
      .queryForCollisionPairs()
      .reduce<Record<string, { o1: PhysicsObject; o2: PhysicsObject }>>((accumulator, currentValue, i) => {
        let pairId = getArrayPairId(currentValue)
        accumulator[pairId] = {o1: currentValue[0], o2: currentValue[1]}
        return accumulator
      }, {})

    for (let pairId of Object.keys(this.previousCollisionPairs)) {
      let pairObj = this.previousCollisionPairs[pairId]

      // existed in previous pairs, but not during this step: this pair stopped colliding
      if (pairId in this.stepCollidingPairs === false) {
        this.gameEngine.events.emit(`collisionStop`, pairObj)
      }
    }

    for (let pairId of Object.keys(this.stepCollidingPairs)) {
      let pairObj = this.stepCollidingPairs[pairId]

      // didn't exist in previous pairs, but exists now: this is a new colliding pair
      if (pairId in this.previousCollisionPairs === false) {
        this.gameEngine.events.emit(`collisionStart`, pairObj)
      }
    }

    this.previousCollisionPairs = this.stepCollidingPairs
  }

  /**
   * checks wheter two objects are currently colliding
   * @param {Object} o1 first object
   * @param {Object} o2 second object
   * @return {boolean} are the two objects colliding?
   */
  areObjectsColliding(o1: PhysicsObject, o2: PhysicsObject) {
    return getArrayPairId([o1, o2]) in this.stepCollidingPairs
  }
}

function getArrayPairId(arrayPair: [PhysicsObject, PhysicsObject]) {
  // make sure to get the same id regardless of object order
  let sortedArrayPair = arrayPair.slice(0).sort()
  return sortedArrayPair[0].id + `-` + sortedArrayPair[1].id
}

export default HSHGCollisionDetection
