export interface SchedulerOptions { tick: () => unknown; period?: number; delay?: number; stepPeriod?: number }
import EventEmitter from 'eventemitter3'
import Utils from './Utils';

const SIXTY_PER_SEC = 1000 / 60
const LOOP_SLOW_THRESH = 0.3
const LOOP_SLOW_COUNT = 10

/**
 * Scheduler class
 *
 */
export default class Scheduler {
  declare options: Required<Pick<SchedulerOptions, "tick" | "period" | "delay">> & Pick<SchedulerOptions, "stepPeriod">
  declare nextExecTime: number | null
  declare requestedDelay: number
  declare delayCounter: number
  declare events: InstanceType<typeof EventEmitter>

  /**
   * schedule a function to be called
   *
   * @param {Object} options the options
   * @param {Function} options.tick the function to be called
   * @param {Number} options.period number of milliseconds between each invocation, not including the function's execution time
   * @param {Number} options.delay number of milliseconds to add when delaying or hurrying the execution
   */
  constructor(options: SchedulerOptions) {
    this.options = Object.assign(
      {
        tick: () => {},
        period: SIXTY_PER_SEC,
        delay: SIXTY_PER_SEC / 3
      },
      options
    )
    this.nextExecTime = null
    this.requestedDelay = 0
    this.delayCounter = 0

    // mixin for EventEmitter
    this.events = new EventEmitter()
  }

  // in same cases, setTimeout is ignored by the browser,
  // this is known to happen during the first 100ms of a touch event
  // on android chrome.  Double-check the game loop using requestAnimationFrame
  nextTickChecker() {
    let currentTime = Utils.getCurrentTimestamp()
    if (currentTime > (this.nextExecTime ?? 0)) {
      this.delayCounter++
      this.callTick()
      this.nextExecTime = currentTime + (this.options.stepPeriod ?? this.options.period)
    }
    window.requestAnimationFrame(this.nextTickChecker.bind(this))
  }

  nextTick() {
    let stepStartTime = Utils.getCurrentTimestamp()
    if (
      stepStartTime >
      (this.nextExecTime ?? 0) + this.options.period * LOOP_SLOW_THRESH
    ) {
      this.delayCounter++
    } else this.delayCounter = 0

    this.callTick()
    this.nextExecTime =
      stepStartTime + this.options.period + this.requestedDelay
    this.requestedDelay = 0
    setTimeout(
      this.nextTick.bind(this),
      this.nextExecTime - Utils.getCurrentTimestamp()
    )
  }

  callTick() {
    if (this.delayCounter >= LOOP_SLOW_COUNT) {
      this.events.emit(`loopRunningSlow`)
      this.delayCounter = 0
    }
    this.options.tick()
  }

  /**
   * start the schedule
   * @return {Scheduler} returns this scheduler instance
   */
  start() {
    setTimeout(this.nextTick.bind(this))
    global.requestAnimationFrame(this.nextTickChecker.bind(this))
    return this
  }

  /**
   * delay next execution
   */
  delayTick() {
    this.requestedDelay += this.options.delay
  }

  /**
   * hurry the next execution
   */
  hurryTick() {
    this.requestedDelay -= this.options.delay
  }
}
