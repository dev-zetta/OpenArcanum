// @flow

import type System from './System'
import type Actor from './Actor'
import Utils from '../../misc/Utils'
export { scorer } from './Utils'

export default class Action {
  static Impossible = 0.0
  static Score100 = 1.0
  static Score50 = 0.5
  static Score25 = 0.25
  static NoScore = 0.0

  actor: Actor
  scheme: Object
  //condition: Function
  actions: Map<string, Action>
  parent: ?Action
  context: Object
  startedAt: number
  stoppedAt: number

  /**
   *
   * @param actor
   * @param scheme
   * @param context
   * @param score
   */
  constructor(actor: Actor, scheme: Object, context: Object, score: number) {
    //this.scores = []
    this.actor = actor
    this.scheme = scheme
    this.score = score
    //this.condition = () => true
    this.actions = new Map()
    this.context = context
    this.parent = null

    lll(`new action`, this.name, score)
  }

  /**
   *
   * @returns {*}
   */
  get name() {
    return this.constructor.name
  }

  /**
   *
   * @returns {boolean}
   */
  get started(): boolean {
    return !!this.startedAt
  }

  /**
   *
   * @returns {boolean}
   */
  get finished(): boolean {
    return !!this.stoppedAt
  }

  /**
   *
   * @returns {System}
   */
  get system(): System {
    return this.actor.system
  }

  // setCondition(callback) {
  //   if (!callback) {
  //     throw Error(`UtilityAi#Action#condition: Missing callback`)
  //   }
  //
  //   this.condition = callback
  // }

  /**
   *
   * @param action
   */
  addAction(action: Action) {
    action.parent = this
    this.actions.set(action.name, action)
  }

  /**
   *
   * @param action
   */
  removeAction(action: Action) {
    action.parent = null
    this.actions.delete(action.name)
  }

  /**
   *
   * @param msg
   */
  log(...msg) {
    if (!this._print_debug) return
    lle(...msg)
  }

  // queueAction(name, data) {
  //   let action = this.system.newAction(name, data)
  //   this.addChild(action)
  // }

  /**
   *
   * @param context
   */
  start(context: Object = this.context) {
    this.startedAt = Utils.getCurrentTimestamp()
    this.context = context
    lll(`Start action`, this.name)

    let callbacks = this.build(context)
    for (name in callbacks) {
      this[name] = callbacks[name].bind(this)
    }

    this.onStart()

    if (this.parent && this.parent.onChildStarted) {
      this.parent.onChildStarted(this)
    }

    for (let [name, action] of this.actions) {
      if (!action.started) {
        action.start()
      }
    }
  }

  /**
   *
   */
  stop() {
    this.stoppedAt = Utils.getCurrentTimestamp()
    lll(`Stop action`, this.name)

    this.onStop()

    if (this.parent && this.parent.onChildStopped) {
      this.parent.onChildStopped(this)
    }

    for (let [name, action] of this.actions) {
      //debugger
      if (!action.finished) {
        action.stop()
      }
    }
  }

  /**
   *s
   * @param elapsed
   * @param context
   */
  update(elapsed: number): boolean {
    if (this.stoppedAt) {
      return false
    }

    if (!this.startedAt) {
      this.start(this.context)
    }

    let updated = this.onUpdate(elapsed)
    if (updated === true) {
      if (this.scheme.totalActions) {
        updated = this.actor.updateScheme(
          this.scheme,
          this,
          this.context,
          elapsed
        )
      }
    } else {
      lle(`not updated`, this.name)
    }

    if (updated !== true) {
      this.stop()
    }

    //  = false
    // for (let [name, action] of this.actions) {
    //   updated = action.update(elapsed)
    //
    //   if (!updated) {
    //   }
    // }
    //
    // if (!updated) {
    //   return false
    // }

    return updated
  }

  /**
   *
   * @param action
   */
  onChildStarted(action: Action) {}

  /**
   *
   * @param action
   */
  onChildStopped(action: Action) {}

  /**
   *
   * @returns {*}
   */
  toString() {
    return this.name
  }
}
