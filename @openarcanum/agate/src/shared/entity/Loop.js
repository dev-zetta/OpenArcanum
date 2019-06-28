import Messenger from './Messenger.js'

/**
 * Game loop with independent clock events for fixed durations and variable
 * durations.
 * @param {Messenger} messenger
 * @constructor
 */
export default class Loop {
  constructor(messenger) {
    // Messenger we'll use for clock signals
    this.messenger = messenger || new Messenger()

    this.fixedDuration = 8
    this.started = false

    // Live stats
    this.currentTime = 0
    this.fixedStepsPerFrame = 0
    this.fixedTimePerFrame = 0
    this.renderTimePerFrame = 0
    this.frameTime = 0
  }

  /**
   * Fire.
   */
  start() {
    if (this.started) return

    // Loop params and syncing
    let lastTime = 0
    let simAcc = 0
    let simTime = 0
    const simStep = this.fixedDuration
    const messenger = this.messenger
    const _this = this

    // Stats
    let simStart = 0
    let renderStart = 0
    let frameStart = 0

    function loop(time) {
      global.requestAnimationFrame(loop)

      // Log duration of each raf-fired frame
      if (frameStart) _this.frameTime = global.performance.now() - frameStart
      frameStart = global.performance.now()

      // Determine what our delta is since last raf-frame
      const dt = lastTime ? time - lastTime : 0

      messenger.resetCounters()

      // Dump as much time that has passed into the simulator time accumulator.
      simAcc += dt

      // Continue to step the fixed loop until we run out of time on the
      // accumulator
      _this.fixedStepsPerFrame = 0
      simStart = global.performance.now()
      while (simAcc >= simStep) {
        messenger.trigger(Loop.FIXED_TICK, simStep, simTime)
        simTime += simStep
        simAcc -= simStep
        _this.fixedStepsPerFrame++
      }
      _this.fixedTimePerFrame = global.performance.now() - simStart
      _this.currentTime = simTime

      // Fire the variable step clock once
      renderStart = global.performance.now()
      messenger.trigger(Loop.TICK, dt, time)
      _this.renderTimePerFrame = global.performance.now() - renderStart
      lastTime = time
    }

    // BOOM
    global.requestAnimationFrame(loop)
    this.started = true
  }

  /**
   * Convenience function for variable tick event.
   * @param {Function} fn
   */
  onTick(fn) {
    return this.messenger.listenTo(Loop.TICK, fn)
  }

  /**
   * Convenience function for fixed tick event.
   * @param {Function} fn
   */
  onFixedTick(fn) {
    return this.messenger.listenTo(Loop.FIXED_TICK, fn)
  }
}

/**
 * Happens at a variable rate based on system (render loop)
 * @event
 */
Loop.TICK = `Loop#TICK`

/**
 * Happens at a fixed length (simulation loop)
 * @event
 */
Loop.FIXED_TICK = `Loop#FIXED_TICK`
