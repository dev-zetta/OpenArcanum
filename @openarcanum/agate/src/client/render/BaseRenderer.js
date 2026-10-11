const TIME_RESET_THRESHOLD = 100

/**
 * The Renderer is the component which must *draw* the game on the client.
 * It will be instantiated once on each client, and must implement the draw
 * method.  The draw method will be invoked on every iteration of the browser's
 * render loop.
 */
class BaseRenderer {
  /**
   * Constructor of the Renderer singleton.
   * @param {GameEngine} gameEngine - Reference to the GameEngine instance.
   * @param {ClientEngine} clientEngine - Reference to the ClientEngine instance.
   */
  constructor(clientEngine) {
    this.clientEngine = clientEngine
    this.gameEngine = clientEngine.gameEngine
    this.lastTimestamp = 0

    this.gameEngine.events.on(`client__stepReset`, () => {
      this.doReset = true
    })

    this.gameEngine.events.on(`objectAdded`, this.addObject.bind(this))
    this.gameEngine.events.on(`objectDestroyed`, this.removeObject.bind(this))
  }

  /**
   * Initialize the renderer.
   * @return {Promise} Resolves when renderer is ready.
   */
  async init() {
    if (typeof window === `undefined` || !document) {
      console.log(`renderer invoked on server side.`)
    }
    this.gameEngine.events.emit(`client__rendererReady`)
    return true
  }

  reportSlowFrameRate() {
    this.gameEngine.events.emit(`client__slowFrameRate`)
  }

  /**
   * The main draw function.  This method is called at high frequency,
   * at the rate of the render loop.  Typically this is 60Hz, in WebVR 90Hz.
   * If the client gameEngine has been configured to render-schedule, then this
   * method must call the clientEngine's step method.
   *
   * @param {Number} t - current time (only required in render-schedule mode)
   * @param {Number} dt - time elapsed since last draw
   */
  draw(time: number, dt: number) {
    this.lastTimestamp = time
    //this.gameEngine.events.emit(`client__draw`)

    if (this.clientEngine.options.scheduler === `render-schedule`)
      this.runClientStep(time)
  }

  /**
   * The main draw function.  This method is called at high frequency,
   * at the rate of the render loop.  Typically this is 60Hz, in WebVR 90Hz.
   *
   * @param {Number} t - current time
   * @param {Number} dt - time elapsed since last draw
   */
  runClientStep(t) {

    let p = this.clientEngine.options.stepPeriod
    let dt = 0

    // reset step time if we passed a threshold
    if (
      this.doReset ||
      t > this.clientEngine.lastStepTime + TIME_RESET_THRESHOLD
    ) {
      this.doReset = false
      this.clientEngine.lastStepTime = t - p / 2
      this.clientEngine.correction = p / 2
    }

    // catch-up missed steps
    while (t > this.clientEngine.lastStepTime + p) {
      this.clientEngine.step(
        this.clientEngine.lastStepTime + p,
        p + this.clientEngine.correction
      )
      this.clientEngine.lastStepTime += p
      this.clientEngine.correction = 0
    }

    // if not ready for a real step yet, return
    // this might happen after catch up above
    if (t < this.clientEngine.lastStepTime) {
      dt = t - this.clientEngine.lastStepTime + this.clientEngine.correction
      if (dt < 0) dt = 0
      this.clientEngine.correction = this.clientEngine.lastStepTime - t
      this.clientEngine.step(t, dt, true)
      return
    }

    // render-controlled step
    dt = t - this.clientEngine.lastStepTime + this.clientEngine.correction
    this.clientEngine.lastStepTime += p
    this.clientEngine.correction = this.clientEngine.lastStepTime - t
    this.clientEngine.step(t, dt)
  }

  /**
   * Handle the addition of a new object to the world.
   * @param {Object} obj - The object to be added.
   */
  addObject(obj) {}

  /**
   * Handle the removal of an old object from the world.
   * @param {Object} obj - The object to be removed.
   */
  removeObject(obj) {}

  /**
   *
   * @returns {Promise<void>}
   */
  async start() {

  }


  /**
   * Called when clientEngine has stopped, time to clean up
   */
  stop() {}
}

export default BaseRenderer
