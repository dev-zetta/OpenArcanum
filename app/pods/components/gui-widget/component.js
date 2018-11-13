/* global AGate */

import Component from '@ember/component'
import { service } from '@ember-decorators/service'
import { action, computed } from '@ember-decorators/object'
import { classNames, attribute } from '@ember-decorators/component'
import { runTask, runDisposables } from 'ember-lifeline'

import { Engine } from 'open-arcanum/agate/shared/Engine'
import { Manager } from 'open-arcanum/agate/client/Gui'

import widgetLayout from 'open-arcanum/pods/components/gui-widget/template'
import podNames from 'ember-component-css/pod-names'

const getWidgetClass = (type, dot = false) =>
  dot ? `.${podNames[`gui-${type}`]}` : podNames[`gui-${type}`]

let cash = requireNode(`cash-dom`)

import anime from 'ember-animejs'

@classNames(`gui-widget ${getWidgetClass(`widget`)}`)
class GuiWidget extends Component {
  @attribute(`data-id`)
  @computed('widget')
  get dataId() {
    return this.get('widget.id') || 0
  }

  @service
  store
  @service
  hifi

  /*@attribute
  draggable = false*/

  @attribute
  visible = true

  sprite = null

  /**
   *
   */
  constructor() {
    super(...arguments)

    this.getWidgetClass = getWidgetClass
    this.children = new Map()
    this.cachedWidgets = new Map()

    this.set(`layout`, widgetLayout)
  }

  /**
   *
   * @returns {*}
   */
  getElement() {
    if (!this.cashElement) {
      let element = this.get(`element`)
      if (element) {
        this.cashElement = cash(element)
      }
    }
    return this.cashElement
  }

  /**
   *
   * @returns {Ember.View|*|null}
   */
  getParent() {
    return this.parentView
    //return this.get('widget.parent');
  }

  /**
   *
   */
  getChildren() {
    return this.children
    // return this.get('widget.components');
  }

  /**
   *
   * @param id
   * @returns {V}
   */
  getWidget(id) {
    if (!this.cachedWidgets) {
      return null
    }

    let widget = this.cachedWidgets.get(id)

    if (widget) {
      return widget
    }

    widget = this.getManager().findWidget(id)
    if (widget) {
      this.cachedWidgets.set(id, widget)
    }


    return widget
  }

  /**
   *
   * @param child
   */
  addChild(child) {
    let id = child.getId()
    this.children.set(id, child)
  }

  /**
   *
   * @param id
   * @returns {null}
   */
  getChild(id) {
    return this.getManager().findWidget(id, this.children)
  }

  getStore() {
    return this.store // this.get('store')
  }

  getOptions() {
    return this.get(`widget.options`)
  }

  getOption(name) {
    return this.get(`widget.options.${name}`)
  }

  makeChildId(key) {
    let id = this.getId()
    return `${id}.${key}`
  }

  /**
   *
   * @param definition
   * @returns {*|DS.Model}
   */
  createModel(definition) {
    let store = this.getStore()

    let model = store.peekRecord(`gui-widget`, definition.id)
    if (model) {
      console.log(`Already exists, updating`, definition.id)
      for (let property in definition) {
        //if (definition.hasOwnProperty(property)) {
        model.set(property, definition[property])
        //}
      }

      return model
    }
    model = store.createRecord(`gui-widget`, definition)
    return model
  }

  /**
   *
   * @param definition
   * @returns {*|DS.Model}
   */
  createChildModel(definition) {
    return this.createModel(
      Object.assign({parent: this.get(`widget`)}, definition)
    )
  }

  /**
   *
   * @param definition
   */
  createModelsForChildren(definition) {
    for (let key in definition) {
      let widget = Object.assign(
        {
          id: this.makeChildId(key)
        },
        definition[key]
      )

      let model = this.createChildModel(widget)
      this.set(key, model)
    }
  }

  /**
   *
   * @param definition
   */

  createChildren(definition) {
    for (let key in definition) {
      let widget = Object.assign(
        {
          id: this.makeChildId(key)
        },
        definition[key]
      )

      let model = this.createChild(widget)
    }
  }

  /**
   *
   * @param definition
   * @returns {*}
   */
  createChild(definition) {
    let model = this.createChildModel(definition)

    this.get(`widget.components`).pushObject(model)
    return model
  }

  /**
   *
   * @param id
   * @param method
   * @param args
   */
  callComponent(id, method, ...args) {
    let widget = this.getWidget(id)
    if (!widget) {
      AGate.Utils.logError(`Component ${id} not found`)
      return
    }

    if (AGate.Utils.isFunction(widget[method])) {
      widget[method].apply(widget, this, ...args)
      AGate.Utils.logError(`Calling component method ${method}`)
    }else {
      let methods = widget.getMethods()
      if (methods && AGate.Utils.isFunction(methods[method])) {
        methods[method].apply(widget, this, ...args)
        AGate.Utils.logError(`Calling component method ${method}`)
      }
    }
  }

  /**
   *
   * @param name
   * @param args
   */
  emitEvent(name, ...args) {
    if (name.charAt(0) === `:`) {
      // if starts with :, it refers to 'this'
      name = `${this.getId()}${name}`
    }

    this.getEngine().events.emitUI(name, ...args)
  }

  /**
   *
   * @param name
   * @param listener
   */
  listenEvent(name, listener) {
    if (name.charAt(0) === `:`) {
      // if starts with :, it refers to 'this'
      name = `${this.getId()}${name}`
    }

    this.getEngine().events.listenUI(name, listener)
  }

  /**
   *
   * @param name
   * @param listener
   */
  listenEventOnce(name, listener) {
    this.getEngine().events.listenOnceUI(name, listener)
  }

  /**
   * Emit event for given component using its id
   * @param name
   * @param args
   */
  emitComponentEvent(id, name, ...args) {
    this.getEngine().events.emitUI(`${id}:${name}`, ...args)
  }

  /**
   * Listen to events of given component using its id
   * @param name
   * @param listener
   */
  listenComponentEvent(id, name, listener) {
    this.getEngine().events.listenUI(`${id}:${name}`, listener)
  }

  /**
   * Calls own event and emits event to the world, so listeners can receive the event as well
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitOwnEvent(name, ...args) {
    AGate.Utils.log(`emitOwnEvent`, this.getId(), name)
    let events = this.getEvents()
    if (events) {
      let method = events[name]
      if (AGate.Utils.isFunction(method)) {
        method.apply(this, args)
      }
    }

    this.emitComponentEvent(this.getId(), name)
  }

  getComponentName() {
    return this.get(`widget.componentName`)
  }

  getEvents() {
    return this.get(`widget.events`)
  }

  getListeners() {
    return this.get(`widget.listeners`)
  }

  getMethods() {
    return this.get(`widget.methods`)
  }

  /**
   *
   * @returns {Engine}
   */
  getEngine() {
    return Engine.instance
  }

  /**
   *
   * @returns {Client}
   */
  getClient() {
    return this.getEngine().client
  }

  /**
   *
   * @returns {Manager}
   */
  getManager() {
    return this.getEngine().client.guiManager
  }

  /**
   *
   */
  getId() {
    return this.get(`widget.id`)
  }

  /**
   *
   */
  isVisible() {
    return this.get(`widget.visible`)
  }

  /**
   *
   * @param visible
   * @param fade
   */
  setVisibility(visible) {
    if (visible) {
      this.getElement().css({display: `block` })
      this.bringToFront()
      this.emitOwnEvent(`shown`)
    } else {
      this.getElement().css({display: `none` })
      //this.bringToBack()
      this.emitOwnEvent(`hidden`)
    }

    this.set(`widget.visible`, visible)
  }

  /**
   *
   */
  toggleVisibility() {
    this.setVisibility(!this.get(`widget.visible`))
  }

  /**
   *
   * @param animation
   */
  show() {
    if (this.isVisible()) {
      return
    }

    this.setVisibility(true)
  }

  /**
   *
   * @param animation
   */
  hide() {
    if (!this.isVisible()) {
      return
    }

    this.setVisibility(false)
  }

  /**
   *
   * @param animation
   */
  toggle() {
    let visible = this.isVisible()
    this.setVisibility(!visible)
  }

  /**
   *
   * @param animation
   */
  showWithAnim(animation = `show-in`) {
    if (this.isVisible()) {
      return
    }

    this.startAnimation(animation, {}, () => {
      this.setVisibility(true)
    })
  }

  /**
   *
   * @param animation
   */
  hideWithAnim(animation = `show-out`) {
    if (!this.isVisible()) {
      return
    }

    this.startAnimation(animation, {}, () => {
      this.setVisibility(false)
    })
  }

  /**
   *
   * @param animation
   */
  toggleWithAnim(animation = [`show-in`, `show-out`]) {
    let visible = this.isVisible()
    this.startAnimation(visible ? animation[1] : animation[0], {}, () => {
      this.setVisibility(!visible, true)
    })
  }

  /**
   *
   */
  bringToFront() {
    this.getElement().css(`z-index`, `999`)
  }

  /**
   *
   */
  bringToBack() {
    this.getElement().css(`z-index`, `0`)
  }

  /**
   *
   */
  getPosition() {
    return this.get(`widget.position`)
  }

  /**
   *
   * @param left
   * @param top
   */
  setPosition(left, top) {
    this.set(`widget.position`, { left, top })

    this.setStyle({ left: `${left}px`, top: `${top}px` })
  }

  /**
   *
   */
  getSize() {
    return this.get(`widget.size`)
  }

  /**
   *
   * @param width
   * @param height
   */
  setSize(width, height) {
    let element = this.getElement()

    if (element) {
      this.set(`widget.size`, { width, height })

      if (AGate.Utils.isNumber(width)) {
        width = `${width}px`
      }

      if (AGate.Utils.isNumber(height)) {
        height = `${height}px`
      }

      this.setStyle({ width, height })

      element.outerWidth(width)
      element.outerHeight(height)
    } else {
      // Called before DirInsertElement
      super.setSize(...arguments)
    }
  }

  /**
   *
   * @param style
   */
  setStyle(style) {
    let element = this.getElement()
    if (!element) {
      return
    }

    if (AGate.Utils.isString(style)) {
      element.attr(`style`, element.attr(`style`) + `; ` + style)
    } else {
      element.css(style)
    }
  }

  /**
   *
   */
  getSpriteKey() {
    return this.get(`widget.sprite`)
  }

  setSpriteKey(key) {
    this.set(`widget.sprite`, key)
  }

  getSprite(key) {
    return this.get(`sprite`)
  }

  /**
   *
   * @param key
   * @returns {boolean}
   */
  setSprite(key) {
    let element = this.getElement()

    let sprite = this.getSpriteByKey(key)
    if (AGate.Utils.isUndefined(sprite)) {
      AGate.Utils.logError(`Unable to find sprite: `, sprite)
      return false
    }

    let previous = this.getSprite()
    if (AGate.Utils.isObjectLike(previous)) {
      element.removeClass(previous.className)
    }

    element.addClass(sprite.className)

    let size = this.getSize()
    if (!size) {
      let frame = sprite.getFrame()
      this.setSize(frame.width, frame.height)
    }

    this.set(`sprite`, sprite)
  }

  /**
   *
   * @param key
   * @returns {V}
   */
  getSpriteByKey(key) {
    let guiManager = this.getManager()

    let sprite = guiManager.getSprite(key)
    return sprite
  }

  /**
   *
   * @param name
   * @param options
   * @param onFinish
   * @returns {*}
   */
  startAnimation(name, options = {}, onFinish = null) {
    let keyframes = []

    /*sprite.frames.forEach((frame, index) => {
      keyframes[index] = {
        backgroundPosition: `-${frame.left}px 0px`
      };
    });*/

    let timing = {
      duration: AGate.Utils.isNumber(options.duration)
        ? options.duration
        : 1000,
      iterations:
        options.repeat < 0
          ? Infinity
          : AGate.Utils.isNumber(options.repeat)
          ? options.repeat
          : 1
      //
      //playbackRate: 100
    }

    switch (name) {
      case `glow`: {
        keyframes.push({
          boxShadow: `0px 0px 10px 4px rgba(255,187,0,0.62)`
        })

        keyframes.push({
          boxShadow: `0px 0px 20px 8px rgba(0,187,0,0.62)`
        })

        keyframes.push({
          boxShadow: `0px 0px 10px 4px rgba(255,187,0,0.62)`
        })

        timing.easing = `ease-in-out`
        break
      }
      case `background`: {
        let sprite = this.getSprite()
        if (!sprite) {
          break
        }

        let frame = sprite.getLastFrame()
        keyframes.push({
          backgroundPositionX: `-${frame.left + frame.width}px`
        })
        timing.easing = `steps(${sprite.getFrameCount()})`
        break
      }
      case `show-in`: {
        keyframes.push({
          scale: `0.0 0.0`,
          opacity: 0.0,
          display: `none`,
          transform: `translateY(-100%)`
        })

        keyframes.push({
          scale: `1.0 1.0`,
          opacity: 1.0,
          display: `block`,
          transform: `translateY(0%)`
        })

        timing.easing = `ease-in-out`
        timing.fill = `both`
        break
      }
      case `show-out`: {
        keyframes.push({
          scale: `1.0 1.0`,
          opacity: 1.0,
          display: `block`,
          transform: `translateY(0%)`
        })

        keyframes.push({
          scale: `0.0 0.0`,
          opacity: 0.0,
          display: `none`,
          transform: `translateY(-50%)`
        })

        timing.easing = `ease-in-out`
        timing.fill = `both`
        break
      }
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
    let anim = this.get(`element`).animate(keyframes, timing)
    if (onFinish) {
      anim.onfinish = onFinish
    }

    return anim
  }

  /**
   *
   * @param index
   * @returns {boolean}
   */
  changeFrame(index) {
    let sprite = this.getSprite()
    if (!sprite) {
      return false
    }

    if (!sprite.hasFrame(index)) {
      index = 0
    }

    let frame = sprite.getFrame(index)

    let element = this.getElement()
    element.css(`background-position`, `-${frame.left}px -${frame.top}px`)

    this.setSize(frame.width, frame.height)
    return true
  }

  getRandomId() {
    return AGate.Utils.getRandomUUID()
  }

  /**
   *
   */
  didReceiveAttrs() {
    let widgetProps = this.get(`widget`)
    if (!widgetProps) {
      let definition = this.get(`default`)
      widgetProps = this.createModel(
        Object.assign(definition, {id: this.getRandomId()})
      )
      this.set(`widget`, widgetProps)
    }

    let childPartial = this.get(`child_partial`)
    if (!childPartial) {
      let childPartial = `components/${widgetProps.componentName}`
      //let child = childLayout.referrer.moduleName.replace('open-arcanum/pods/', '').replace('/template.hbs', '')
      this.set(`child_partial`, childPartial)
    }

    this.set(`data-id`, this.get(`widget.id`))

    let position = this.get(`widget.position`)
    if (AGate.Utils.isArray(position)) {
      position = { left: position[0], top: position[1] }
      this.set(`widget.position`, position)
    }

    let size = this.get(`widget.size`)
    if (AGate.Utils.isArray(size)) {
      size = { width: size[0], height: size[1] }
      this.set(`widget.size`, size)
    }

    this.updateWidgetAttrs()
  }

  /**
   *
   */
  /*didUpdateAttrs() {
    //super.didUpdateAttrs(...arguments)
  }*/

  applyPosition() {
    // Generate CSS style

    let position = this.get(`widget.position`)
    if (!position) {
      return
    }

    let style = {}

    if (AGate.Utils.isString(position)) {
      // Set alignment
      let align = position.split(`-`)

      switch (align[0]) {
        case `left`:
          style[`left`] = `0`
          style[`right`] = `auto`
          break
        case `right`:
          style[`right`] = `0`
          style[`left`] = `auto`
          break
        case `center`:
          style[`left`] = `0`
          style[`right`] = `0`
          style[`margin-left`] = `auto`
          style[`margin-right`] = `auto`
          break
      }

      switch (align[align.length > 1 ? 1 : 0]) {
        case `top`:
          style[`top`] = `0`
          break
        case `bottom`:
          style[`bottom`] = `0`
          break
        case `center`:
          style[`top`] = `0`
          style[`bottom`] = `0`
          style[`margin-top`] = `auto`
          style[`margin-bottom`] = `auto`
          break
      }
    } else {
      style[`top`] = AGate.Utils.isNumber(position.top)
        ? `${position.top}px`
        : position.top
      style[`left`] = AGate.Utils.isNumber(position.left)
        ? `${position.left}px`
        : position.left
    }

    this.setStyle(style)
  }

  applySize() {
    // set size
    let size = this.get(`widget.size`)
    if (size) {
      this.setSize(size.width, size.height)
    }
  }

  applySprite() {
    // Set background sprite
    let spriteKey = this.getSpriteKey()
    if (spriteKey) {
      this.setSprite(spriteKey)
    }
  }

  applyVisibility() {
    // set visibility
    let visible = this.get(`widget.visible`)
    if (!AGate.Utils.isUndefined(visible)) {
      //style['visibility'] = visible ? 'visible' : 'hidden';
      this.setVisibility(visible)
    }
  }

  applyPrototype() {
    let prototype = this.get(`widget.prototype`)
    if (!prototype) {
      return
    }

    // add user-defined classes
    let element = this.getElement()

    if (prototype) {
      element.addClass(prototype)
    }
  }

  applyStyle() {
    // Set user-defined style
    let rawStyle = this.get(`widget.style`)
    if (rawStyle) {
      this.setStyle(rawStyle)
    }
  }

  updateWidgetAttrs() {
    let element = this.getElement()
    if (!element) {
      return
    }

    this.applyPosition()
    this.applySize()
    this.applySprite()
    this.applyVisibility()
    this.applyStyle()
    this.applyPrototype()
  }

  /**
   *
   */
  didInsertElement() {
    //super.didInsertElement(...arguments)

    //console.log(`didInsertElement`, this.getId(), this.get(`widget`))

    // is it root widget?
    let parent = this.getParent()
    if (!parent.parentView) {
      let manager = this.getManager()
      manager.addWidget(this)
    }

    // add everything except game-render
    if (parent && parent.parentView) {
      parent.addChild(this)
    }

    let element = this.getElement()

    // Set specific class
    let componentName = this.getComponentName()
    if (componentName) {
      element.addClass(componentName)
    }

    {
      let methods = this.getMethods()
      if (AGate.Utils.isString(methods)) {
        methods = Manager.jsonToObject(methods)
        this.set(`widget.methods`, methods)
      }

      /*console.error(methods)
      for (let method in methods) {
        console.error(method)
      }*/

    }

    {
      let events = this.getEvents()
      if (AGate.Utils.isString(events)) {
        events = Manager.jsonToObject(events)
        this.set(`widget.events`, events)
      }
    }

    { // Hook listeners
      let listeners = this.getListeners()
      if (AGate.Utils.isString(listeners)) {
        listeners = Manager.jsonToObject(listeners)

        this.set(`widget.listeners`, listeners)
      }

      for (let name in listeners) {
        let listener = listeners[name]
        console.error(`hooking ${name}`)
        this.listenEvent(name, (...args) => {
          AGate.Utils.logError(`calling listener ${name}`)
          listener.apply(this, args)
        })
      }
    }

    {
      let listeners = [`show`, `hide`, `toggle`]
      for (let name of listeners) {
        this.listenComponentEvent(this.getId(), name, (...args) => {
          AGate.Utils.logError(`calling listener ${name}`)
          this[name](...args)
        })
      }
    }

    this.updateWidgetAttrs()
    this.emitOwnEvent(`created`)
  }

  /**
   *
   */
  didDestroyElement() {
    console.log(`didDestroyElement`, this.getId())
  }

  /**
   *
   */
  didRender() {
    //super.didRender(...arguments)

    let animation = this.get(`widget.animation`)
    if (animation) {
      this.startAnimation(`background`, animation)
    }
  }
  /**
   *
   */
  willDestroyElement() {
    //super.didRender(...arguments)
  }

  willDestroy() {
    this._super(...arguments)
    runDisposables(this) // ensure that lifeline will clean up any remaining async work
  }

  drag(e) {
    //e.preventDefault()
    console.error(`drag`)
    return false
  }

  /**
   *
   * @param e
   * @returns {boolean}
   */
  dragStart(e) {
    //e.preventDefault()

    console.error(`dragStart`)
    return false
  }

  /**
   *
   * @returns {boolean}
   */
  dragOver() {
    console.error(`dragOver`)
    return false
  }

  /**
   *
   * @param e
   */
  drop(e) {
    console.error(`drop`)
    //let id = event.dataTransfer.getData('text/data');
    //this.get('action')(id);
  }

  mouseDown() {
    console.log(`mouseDown`)
  }

  mouseUp() {
    console.log(`mouseUp`)
  }

  /**
   *
   */
  click() {
    /*this.startAnimation(`glow`, {
      duration: 1000
    })*/

    /*anime({
      targets: this.element,
      translateX: '100px'
    });*/

    this.emitOwnEvent(`click`)
  }

  async fetchAudio(id) {
    return `https://soundbible.com/mp3/Tyrannosaurus%20Rex%20Roar-SoundBible.com-807702404.mp3`
  }

  @action
  required(event) {
    if (!event.target.value) {
      this.get(`errors`).pushObject({
        message: `${event.target.name} is required`
      })
    }
  }

  @action
  playAudio(id) {
    this.get(`hifi`)
      .play(this.fetchAudio(id))
      .then(({ sound }) => {
        console.log(sound)
      })
      .catch(error => {
        console.log(error)
      })
  }
}

export default GuiWidget
