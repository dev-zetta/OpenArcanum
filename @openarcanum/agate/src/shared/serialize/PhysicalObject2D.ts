import type { BendingOptions, BendingOverrides, BendingStep } from './types'
import GameObject from './GameObject'
import BaseTypes from './BaseTypes'
import TwoVector from './TwoVector'
import MathUtils from '../misc/MathUtils'

interface PhysicalProps {
  playerId?: number; position?: TwoVector; velocity?: TwoVector;
  angle?: number; mass?: number; angularVelocity?: number;
   width?: number; height?: number; isStatic?: number
}

/**
 * The PhysicalObject2D is the base class for physical game objects in 2D Physics
 */
type XY = { x: number; y: number; copy?(other: XY): unknown }
type Coordinates = XY | Float32Array | number[]
interface PhysicsBody2D { position: Coordinates; velocity: Coordinates; angle: number; angularVelocity: number }
class PhysicalObject2D extends GameObject {
  declare physicsObj: PhysicsBody2D
  declare playerId: number
  declare bendingIncrements: number
  declare position: InstanceType<typeof TwoVector>
  declare velocity: InstanceType<typeof TwoVector>
  declare angle: number
  declare angularVelocity: number
  declare mass: number
  declare class: unknown
  declare incrementScale: number
  declare bendingPositionDelta: TwoVector
  declare bendingVelocityDelta: TwoVector
  declare bendingAVDelta: number
  declare bendingAngleDelta: number
  declare bendingTarget: PhysicalObject2D
  declare bendingOptions: BendingOptions

  /**
   * The netScheme is a dictionary of attributes in this game
   * object.  The attributes listed in the netScheme are those exact
   * attributes which will be serialized and sent from the server
   * to each client on every server update.
   * The netScheme member is implemented as a getter.
   *
   * You may choose not to implement this method, in which
   * case your object only transmits the default attributes
   * which are already part of {@link PhysicalObject2D}.
   * But if you choose to add more attributes, make sure
   * the return value includes the netScheme of the super class.
   *
   * @memberof PhysicalObject2D
   * @member {Object} netScheme
   * @example
   *     static get netScheme() {
   *       return Object.assign({
   *           mojo: { type: 'uint8' },
   *         }, super.netScheme);
   *     }
   */
  static get netScheme() {
    return Object.assign(
      {
        playerId: { type: 'int16' },
        mass: { type: 'float' },
        position: { type: 'class' },
        angle: { type: 'float' },
        velocity: { type: 'class' },
        angularVelocity: { type: 'float' }
      },
      super.netScheme
    )
  }

  /**
   * Creates an instance of a physical object.
   * Override to provide starting values for position, velocity, angle and angular velocity.
   * NOTE: all subclasses of this class must comply with this constructor signature.
   *       This is required because the engine will create temporary instances when
   *       syncs arrive on the clients.
   * @param {GameEngine} gameEngine - the gameEngine this object will be used in
   * @param {Object} options - options for the new object. See {@link GameObject}
   * @param {Object} props - properties to be set in the new object
   * @param {TwoVector} props.position - position vector
   * @param {TwoVector} props.velocity - velocity vector
   * @param {Number} props.angle - orientation angle
   * @param {Number} props.mass - the mass
   * @param {Number} props.angularVelocity - angular velocity
   */
  constructor(gameEngine: ConstructorParameters<typeof GameObject>[0], options?: ConstructorParameters<typeof GameObject>[1], props?: PhysicalProps) {
    super(gameEngine, options)
    this.playerId = 0
    this.bendingIncrements = 0

    // set default position, velocity and quaternion
    this.position = new TwoVector(0, 0)
    this.velocity = new TwoVector(0, 0)
    this.angle = 0
    this.angularVelocity = 0
    this.mass = 0

    // use values if provided
    props = props || {}
    if (props.playerId) this.playerId = props.playerId
    if (props.position) this.position.copy(props.position)
    if (props.velocity) this.velocity.copy(props.velocity)
    if (props.angle) this.angle = props.angle
    if (props.angularVelocity) this.angularVelocity = props.angularVelocity
    if (props.mass) this.mass = props.mass

    this.class = PhysicalObject2D
  }

  /**
   * Called after the object is added to to the game world.
   * This is the right place to add renderer sub-objects, physics sub-objects
   * and any other resources that should be created
   */
  onAddToWorld() {}

  /**
   * Formatted textual description of the dynamic object.
   * The output of this method is used to describe each instance in the traces,
   * which significantly helps in debugging.
   *
   * @return {String} description - a string describing the PhysicalObject2D
   */
  toString() {
    let p = this.position.toString()
    let v = this.velocity.toString()
    let a = this.angle
    let av = this.angularVelocity
    return `phyObj2D[${this.id}] player${this.playerId} Pos=${p} Vel=${v} Ang=${a} AVel=${av}`
  }

  /**
   * Each object class can define its own bending overrides.
   * return an object which can include attributes: position, velocity,
   * angle, and angularVelocity.  In each case, you can specify a min value, max
   * value, and a percent value.
   *
   * @return {Object} bending - an object with bending paramters
   */
  get bending(): BendingOverrides {
    return {
      // example:
      // position: { percent: 0.8, min: 0.0, max: 4.0 },
      // velocity: { percent: 0.4, min: 0.0 },
      // angularVelocity: { percent: 0.0 },
      // angleLocal: { percent: 0.0 }
    }
  }

  // display object's physical attributes as a string
  // for debugging purposes mostly
  bendingToString() {
    if (this.bendingIncrements)
      return `ΔPos=${this.bendingPositionDelta} ΔVel=${this.bendingVelocityDelta} ΔAngle=${this.bendingAngleDelta} increments=${this.bendingIncrements}`
    return `no bending`
  }

  // derive and save the bending increment parameters:
  // - bendingPositionDelta
  // - bendingVelocityDelta
  // - bendingAVDelta
  // - bendingAngleDelta
  // these can later be used to "bend" incrementally from the state described
  // by "original" to the state described by "self"
  bendToCurrent(original: PhysicalObject2D, percent: number, worldSettings: unknown, isLocal: boolean, increments: number) {
    let bending = {increments, percent}
    // if the object has defined a bending multiples for this object, use them
    let positionBending = Object.assign({}, bending, this.bending.position)
    let velocityBending = Object.assign({}, bending, this.bending.velocity)
    let angleBending = Object.assign({}, bending, this.bending.angle)
    let avBending = Object.assign({}, bending, this.bending.angularVelocity)

    // check for local object overrides to bendingTarget
    if (isLocal) {
      Object.assign(positionBending, this.bending.positionLocal)
      Object.assign(velocityBending, this.bending.velocityLocal)
      Object.assign(angleBending, this.bending.angleLocal)
      Object.assign(avBending, this.bending.angularVelocityLocal)
    }

    // get the incremental delta position & velocity
    this.incrementScale = percent / increments
    this.bendingPositionDelta = original.position.getBendingDelta(
      this.position,
      positionBending
    )
    this.bendingVelocityDelta = original.velocity.getBendingDelta(
      this.velocity,
      velocityBending
    )

    // get the incremental angular-velocity
    this.bendingAVDelta =
      (this.angularVelocity - original.angularVelocity) *
      this.incrementScale *
      avBending.percent

    // get the incremental angle correction
    this.bendingAngleDelta =
      MathUtils.interpolateDeltaWithWrapping(
        original.angle,
        this.angle,
        angleBending.percent,
        0,
        2 * Math.PI
      ) / increments

    this.bendingTarget = Reflect.construct(this.constructor, []) as PhysicalObject2D
    this.bendingTarget.syncTo(this)

    // revert to original
    this.position.copy(original.position)
    this.angle = original.angle
    this.angularVelocity = original.angularVelocity
    this.velocity.copy(original.velocity)

    this.bendingIncrements = increments
    this.bendingOptions = bending

    this.refreshToPhysics()
  }

  syncTo(other: PhysicalObject2D, options?: {keepVelocity?: boolean}) {
    super.syncTo(other)

    this.position.copy(other.position)
    this.angle = other.angle
    this.angularVelocity = other.angularVelocity

    if (!options || !options.keepVelocity) {
      this.velocity.copy(other.velocity)
    }

    if (this.physicsObj) this.refreshToPhysics()
  }

  // update position, angle, angular velocity, and velocity from new physical state.
  refreshFromPhysics() {
    this.copyVector(this.physicsObj.position, this.position)
    this.copyVector(this.physicsObj.velocity, this.velocity)
    this.angle = this.physicsObj.angle
    this.angularVelocity = this.physicsObj.angularVelocity
  }

  // generic vector copy.  We need this because different
  // physics engines have different implementations.
  // TODO: Better implementation: the physics engine implementor
  // should define copyFromLanceVector and copyToLanceVector
  copyVector(source: Coordinates, target: Coordinates) {
    const indexed = source as ArrayLike<number>
    const sourceVec = typeof indexed[0] === 'number' && typeof indexed[1] === 'number'
      ? {x: indexed[0], y: indexed[1]} : source as XY
    if ('copy' in target && typeof target.copy === 'function') target.copy(sourceVec)
    else if (target instanceof Float32Array) { target[0] = sourceVec.x; target[1] = sourceVec.y }
    else { (target as XY).x = sourceVec.x; (target as XY).y = sourceVec.y }
  }

  // update position, angle, angular velocity, and velocity from new game state.
  refreshToPhysics() {
    this.copyVector(this.position, this.physicsObj.position)
    this.copyVector(this.velocity, this.physicsObj.velocity)
    this.physicsObj.angle = this.angle
    this.physicsObj.angularVelocity = this.angularVelocity
  }

  // apply one increment of bending
  applyIncrementalBending(stepDesc?: BendingStep) {
    if (this.bendingIncrements === 0) return

    let timeFactor = 1
    if (stepDesc && stepDesc.dt) timeFactor = stepDesc.dt / (1000 / 60)

    const posDelta = this.bendingPositionDelta
      .clone()
      .multiplyScalar(timeFactor)
    const velDelta = this.bendingVelocityDelta
      .clone()
      .multiplyScalar(timeFactor)
    this.position.add(posDelta)
    this.velocity.add(velDelta)
    this.angularVelocity += this.bendingAVDelta * timeFactor
    this.angle += this.bendingAngleDelta * timeFactor

    this.bendingIncrements--
  }

  // interpolate implementation
  interpolate(nextObj: PhysicalObject2D, percent: number) {
    // slerp to target position
    this.position.lerp(nextObj.position, percent)
    this.angle = MathUtils.interpolateDeltaWithWrapping(
      this.angle,
      nextObj.angle,
      percent,
      0,
      2 * Math.PI
    )
  }
}

export default PhysicalObject2D
