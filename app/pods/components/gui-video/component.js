/* global AGate */

import GuiWidget from '../gui-widget'

import { classNames, attribute } from '@ember-decorators/component'
import { tagName } from '@ember-decorators/component'
import { action, computed } from '@ember-decorators/object'

let videojs = requireNode(`video.js`)

//@tagName(`video`)
//@classNames(`video-js`)
class GuiVideo extends GuiWidget {
  default = {
    type: `video`,
    size: [300, 200]
  }

  setup = {
    autoplay: false,
    controls: true,
    fluid: true
  }

  preload = `auto`

  /**
   * Properties which will be bound to the video.js player.
   *
   * @property playerAttributeBindings
   * @type Array
   * @private
   */
  playerAttributeBindings = [
    `autoplay`,
    `controls`,
    `fluid`,
    `language`,
    `loop`,
    `muted`,
    `playbackRate`,
    `poster`,
    `src`,
    `volume`
  ]

  /**
   * Set up property bindings for each property defined in
   * `playerAttributeBindings`.
   *
   * @method setupPlayerAttributeBindings
   */
  setupPlayerAttributeBindings() {
    this.get(`playerAttributeBindings`).forEach((property) => {
      this.bindPropertyToPlayer(property)
    })
  }

  /**
   * The set of video.js player events (and associated actions) to be set up
   * inside `didInsertElement`. If you need to respond to custom video.js
   * player events, such as those emitted by a plugin, you should do so by
   * calling `sendActionOnPlayerEvent` inside your `ready` handler.
   *
   * ```javascript
   * import Ember from 'ember';
   *
   * export default Ember.Controller.extend({
   *   actions: {
   *     ready(player, component) {
   *       component.sendActionOnPlayerEvent(player, 'actionName', 'eventName');
   *     }
   *   }
   * });
   * ```
   *
   * The above would send the `actionName` action in response to an `eventName`
   * event from the player.
   *
   * @property playerEvents
   * @type Object
   * @private
   */
  playerEvents = {
    abort: `abort`,
    canplay: `canplay`,
    canplaythrough: `canplaythrough`,
    durationchange: `durationchange`,
    emptied: `emptied`,
    ended: `ended`,
    error: `error`,
    loadeddata: `loadeddata`,
    loadedmetadata: `loadedmetadata`,
    loadstart: `loadstart`,
    pause: `pause`,
    play: `play`,
    playing: `playing`,
    progress: `progress`,
    ratechange: `ratechange`,
    resize: `resize`,
    seeked: `seeked`,
    seeking: `seeking`,
    stalled: `stalled`,
    suspend: `suspend`,
    timeupdate: `timeupdate`,
    useractive: `useractive`,
    userinactive: `userinactive`,
    volumechange: `volumechange`,
    waiting: `waiting`
  }


  /*constructor() {
    super(...arguments)
  }*/

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    this.set(`src`, this.getOption(`src`))
  }

  /**
   * Sets up a (one-way) binding for a property from this component to the
   * video.js player. If the property is changed, it will be propagated to the
   * video.js player (via `setPlayerProperty`).
   *
   * @method bindPropertyToPlayer
   * @param {Player} player the video.js player instance
   * @param {String} property the component property to bind
   * @param {String} playerProperty the video.js player property
   * @see {#setPlayerProperty}
   */
  bindPropertyToPlayer(property, playerProperty = property) {
    const observer = function() {
      this.setPlayerProperty(playerProperty, this.get(property))
    }

    const scheduledObserver = function() {
      Ember.run.scheduleOnce(`render`, this, observer)
    }

    this._addPlayerObserver(property, this, scheduledObserver)

    // Invoke the observer once to set the initial value on the player.
    observer.call(this)
  }

  /**
   * Initializes the video.js player, sets up event listeners defined in
   * `playerEvents`, and sends the `ready` action.
   *
   * @method didInsertElement
   */
  didInsertElement() {
    super.didInsertElement(...arguments)

    let element = this.get(`element`)
    //element.classList.add('video-js')

    let video = element.getElementsByClassName(`video-js`)[0]

    this.player = videojs(video, this.get(`setup`))
    this.player.ready(() => {
      // Set up a handler to automatically dispose the player on teardown.
      this.one(`willDestroyElement`, () => {
        this.player.dispose()
      })

      // Set up event listeners defined in `playerEvents`.
      const playerEvents = this.get(`playerEvents`)
      if (playerEvents) {
        for (let key in playerEvents) {
          if (!playerEvents.hasOwnProperty(key)) {
            continue
          }

          this.player.on(playerEvents[key], (...args) => {
            //console.error('calling ' + key)
            this[key](...args)
          })
        }
      }

      this.ready()
    })
  }

  /**
   * Sets the value of a property on a video.js player. If the property is
   * already equal to the given value, no change is made.
   *
   * @method setPlayerProperty
   * @param {Player} player the video.js player instance
   * @param {String} playerProperty the name of the property to set
   * @param {Object} value the value to set
   */
  setPlayerProperty(playerProperty, value) {
    const propertyMethod = this.player[playerProperty]
    if (propertyMethod) {
      this.player[playerProperty](value)

      /*const previousValue = propertyMethod.call(this.player)
      if (previousValue !== value) {
        propertyMethod.call(this.player, value)
      }*/
    }
  }

  _addPlayerObserver(property, target, observer) {
    if (this.isDestroying) {
      return
    }

    this.addObserver(property, target, observer)

    this.one(`willDestroyElement`, this, function() {
      this.removeObserver(property, target, observer)
    })
  }

  click() {
    //this.player.play()
  }

  @action
  ready(...args) {
    this.setupPlayerAttributeBindings()

    //this.player.start()
    //this.ready(player, component, ...args);
  }

  @action
  abort() {}

  @action
  canplay() {}

  @action
  canplaythrough() {}

  @action
  durationchange() {}

  @action
  emptied() {}

  @action
  ended() {}

  @action
  error() {}

  @action
  loadeddata() {}

  @action
  loadedmetadata() {}

  @action
  loadstart() {}

  @action
  pause() {}

  @action
  play() {}

  @action
  playing() {}

  @action
  progress() {}

  @action
  ratechange() {}

  @action
  resize() {}

  @action
  seeked() {}

  @action
  seeking() {}

  @action
  stalled() {}

  @action
  suspend() {}

  @action
  timeupdate() {}

  @action
  useractive() {}

  @action
  userinactive() {}

  @action
  volumechange() {}

  @action
  waiting() {}
}

export default GuiVideo
