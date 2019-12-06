// @flow

import type System from './System'
import type Evaluator from './Evaluator'
import Utils from '../../misc/Utils'

export default class Action {
  evaluator: Evaluator
  //condition: Function
  children: Map<string,  Action>
  parent: Action
  context: Object
  startedAt: number
  stoppedAt: number

  constructor(evaluator: Evaluator, context: Object = {}) {
    //this.scores = []
    this.evaluator = evaluator
    //this.condition = () => true
    this.children = new Map()
    this.context = context
    this.parent = null
  }

  get name() {
    return this.constructor.name
  }

  get started(): boolean {
    return !!this.startedAt
  }

  get finished(): boolean {
    return !!this.stoppedAt
  }

  get system(): System {
    return this.evaluator.system
  }

  // setCondition(callback) {
  //   if (!callback) {
  //     throw Error(`UtilityAi#Action#condition: Missing callback`)
  //   }
  //
  //   this.condition = callback
  // }

  addChild(action: Action) {
    action.parent = this
    this.children.set(action.name, action)
  }

  log(...msg) {
    if (!this._print_debug) return
    lle(...msg)
  }


  queueAction(name, data) {
    let action = this.system.newAction(name, data)
    this.addChild(action)
  }

  start(context: Object = this.context) {
    this.startedAt = Utils.getCurrentTimestamp()
    this.context = context
    lll('Start action', this.name)

    this.onStart(context)

    if (this.parent) {
      this.parent.onChildStarted(this)
    }

    for (let [name, action] of this.children) {
      if (!action.started) {
        action.start()
      }
    }
  }

  stop(context: Object = this.context) {
    this.stoppedAt = Utils.getCurrentTimestamp()
    lll('Stop action', this.name)

    this.onStop(context)

    if (this.parent) {
      this.parent.onChildStopped(this)
    }

    for (let [name, action] of this.children) {
      if (!action.finished) {
        action.stop()
      }
    }
  }

  /**
   *
   * @param elapsed
   * @param context
   */
  update(elapsed: number, context: Object = this.context): boolean {
    if (this.stoppedAt) {
      return
    }

    if (!this.startedAt) {
      this.start(context)
    }

    this.onUpdate(elapsed, context)

    let updated = false
    for (let [name, action] of this.children) {

      updated = action.update(elapsed)

      if (!updated) {

      }
    }

    if (!updated) {
      return false
    }

    return true
  }

  onChildStarted(action: Action) {

  }

  onChildStopped(action: Action) {

  }

}

Action.Impossible = -100

Action.Score100 = 100
Action.Score50 = 50
Action.Score25 = 25
Action.NoScore = 0
