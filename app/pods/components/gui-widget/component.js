import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import { utils as runtimeUtils } from 'open-arcanum/lib/runtime'
/* global AGate */

import Component from '@ember/component'
import { service } from '@ember/service'
import { action, computed } from '@ember/object'

//import cash from 'cash-dom'

import cash from 'cash-dom'

const Utils = runtimeUtils

const getWidgetClass = (type, dot = false) =>
  dot ? `.gui-${type}` : `gui-${type}`

class GuiWidget extends Component {
  classNames = ['gui-widget']
  attributeBindings = ['dataId:data-id', 'tooltip:title']
  default = { type: 'widget', options: {} }
  errors = []

  @computed('widget.options.tooltip')
  get tooltip() { return this.get('widget.options.tooltip') }


  @computed(`widget`)
  get dataId() {
    return this.get(`widget.id`) || 0
  }

  @service
  store

  visible = true
  sprite = null

  MethodListeners = [`show`, `hide`, `toggle`]

  /**
   *
   */
  constructor() {
    super(...arguments)

    this.getWidgetClass = getWidgetClass
    this.children = new Map()
    this.cachedWidgets = new Map()

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
    return this.parentWidget || this.parentView
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
      this.cachedWidgets = new Map()
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

  /**
   *
   * @returns {*}
   */
  getStore() {
    return this.store // this.get('store')
  }

  /**
   *
   * @returns {*}
   */
  getOptions() {
    return this.get(`widget.options`)
  }

  /**
   *
   * @param name
   * @returns {*}
   */
  getOption(name) {
    return this.get(`widget.options.${name}`)
  }

  /**
   *
   * @param key
   * @returns {string}
   */
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
      this.listenComponentEventOnce(id, `created`, () => {
        this.callComponent(id, method, ...args)
      })

      Utils.logError(`Component ${id} not found`, widget)
      return
    }

    this.callMethod(widget, method, args)
  }

  /**
   *
   * @param widget
   * @param method
   * @param args
   * @private
   */
  callMethod(widget, method, args) {
    args = [this].concat(args)

    /*if (AGate.Utils.isFunction(widget[method])) {
      widget[method].apply(widget, args)
      AGate.Utils.logError(`Calling native component method ${method}`)
    } else {*/
    let methods = widget.getMethods()
    if (methods && Utils.isFunction(methods[method])) {
      methods[method].apply(widget, args)
      Utils.logError(`Calling user component method ${method}`)
    }
    //}
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

    this.getClient().emitUI(name, ...args)
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

    this.getClient().listenUI(name, listener)
  }

  /**
   *
   * @param name
   * @param listener
   */
  listenEventOnce(name, listener) {
    this.getClient().listenOnceUI(name, listener)
  }

  /**
   * Emit event for given component using its id
   * @param name
   * @param args
   */
  emitComponentEvent(id, name, ...args) {
    this.getClient().emitUI(`${id}:${name}`, ...args)
  }

  /**
   * Listen to events of given component using its id
   * @param name
   * @param listener
   */
  listenComponentEvent(id, name, listener, context) {
    this.getClient().listenUI(`${id}:${name}`, listener, context)
  }

  /**
   * Listen to events of given component using its id
   * @param name
   * @param listener
   */
  listenComponentEventOnce(id, name, listener, context) {
    this.getClient().listenOnceUI(`${id}:${name}`, listener, context)
  }

  /**
   * Calls own event and emits event to the world, so listeners can receive the event as well
   * @param name
   * @param args
   * @returns {boolean}
   */
  emitOwnEvent(name, ...args) {
    //Utils.log(`emitOwnEvent`, this.getId(), name)
    let events = this.getEvents()
    if (events) {
      let method = events[name]
      if (Utils.isFunction(method)) {
        method.apply(this, args)
      }
    }

    //lle('dfsf', name)
    this.emitComponentEvent(this.getId(), name)
  }

  /**
   *
   * @returns {*}
   */
  getComponentName() {
    return this.get(`widget.componentName`)
  }

  /**
   *
   * @returns {*}
   */
  getEvents() {
    return this.get(`widget.events`)
  }

  /**
   *
   * @returns {*}
   */
  getListeners() {
    return this.get(`widget.listeners`)
  }

  /**
   *
   * @returns {*}
   */
  getMethods() {
    return this.get(`widget.methods`)
  }

  /**
   *
   * @returns {GameEngine}
   */
  getEngine() {
    return AGate.engine
  }

  /**
   *
   * @returns {ClientEngine}
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
  getDatabase() {
    return this.getEngine().database
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
  isHidden() {
    return !this.get(`widget.visible`)
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
    if (!this.isHidden()) {
      return
    }

    this.setVisibility(true)
  }

  /**
   *
   * @param animation
   */
  hide() {
    if (this.isHidden()) {
      return
    }

    this.setVisibility(false)
  }

  /**
   *
   * @param animation
   */
  toggle() {
    let hidden = this.isHidden()
    this.setVisibility(!hidden)
  }

  /**
   *
   * @param animation
   */
  showWithAnim(animation = `show-in`) {
    if (!this.isHidden()) {
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
    if (this.isHidden()) {
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
    let visible = !this.isHidden()
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

      if (Utils.isNumber(width)) {
        width = `${width}px`
      }

      if (Utils.isNumber(height)) {
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

    if (Utils.isString(style)) {
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

  /**
   *
   * @param key
   */
  setSpriteKey(key) {
    this.set(`widget.sprite`, key)
  }

  /**
   *
   * @param key
   * @returns {*}
   */
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
    if (Utils.isUndefined(sprite)) {
      Utils.logError(`Unable to find sprite: `, sprite)
      return false
    }

    let previous = this.getSprite()
    if (Utils.isObjectLike(previous)) {
      previous.detachFromElement(element)
    }

    sprite.attachToElement(element)

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
    let sprite = this.getManager().getSprite(key)
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
      duration: Utils.isNumber(options.duration)
        ? options.duration
        : 1000,
      iterations:
        options.repeat < 0
          ? Infinity
          : Utils.isNumber(options.repeat)
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

  /**
   *
   */
  getRandomId() {
    return crypto.randomUUID()
  }

  /**
   *
   */
  didReceiveAttrs() {
    let widgetProps = this.get(`widget`)
    if (!widgetProps) {
      let definition = this.get(`default`)
      widgetProps = this.createModel(
        Object.assign({}, definition, {id: this.getRandomId()})
      )
      this.set(`widget`, widgetProps)
    }

    this.set(`data-id`, this.get(`widget.id`))

    let position = this.get(`widget.position`)
    if (Utils.isArray(position)) {
      position = { left: position[0], top: position[1] }
      this.set(`widget.position`, position)
    }

    let size = this.get(`widget.size`)
    if (Utils.isArray(size)) {
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

    if (Utils.isString(position)) {
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
      style[`top`] = Utils.isNumber(position.top)
        ? `${position.top}px`
        : position.top
      style[`left`] = Utils.isNumber(position.left)
        ? `${position.left}px`
        : position.left
    }

    this.setStyle(style)
  }

  /**
   *
   */
  applySize() {
    // set size
    let size = this.get(`widget.size`)
    if (size) {
      this.setSize(size.width, size.height)
    }
  }

  /**
   *
   */
  applySprite() {
    // Set background sprite
    let spriteKey = this.getSpriteKey()
    if (spriteKey) {
      this.setSprite(spriteKey)
    }
  }

  /**
   *
   */
  applyVisibility() {
    // set visibility
    let visible = this.get(`widget.visible`)
    if (!Utils.isUndefined(visible)) {
      //style['visibility'] = visible ? 'visible' : 'hidden';
      this.setVisibility(visible)
    }
  }

  /**
   *
   */
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

  /**
   *
   */
  applyStyle() {
    // Set user-defined style
    let rawStyle = this.get(`widget.style`)
    if (rawStyle) {
      this.setStyle(rawStyle)
    }
  }

  /**
   *
   */
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
  applyMethods() {
    // Hook methods
    let methods = this.getMethods()
    if (Utils.isString(methods)) {
      methods = Utils.jsonToObject(methods)
      this.set(`widget.methods`, methods)
    }

    for (let name in methods) {
      let method = methods[name]
      this[name] = method.bind(this, this) // sel caller as this
    }
  }

  /**
   *
   */
  applyEvents() {
    // Hook events
    let events = this.getEvents()
    if (Utils.isString(events)) {
      events = Utils.jsonToObject(events)
      this.set(`widget.events`, events)
    }
  }

  /**
   *
   */
  applyListeners() {
    // Hook listeners
    let listeners = this.getListeners()
    if (Utils.isString(listeners)) {
      listeners = Utils.jsonToObject(listeners)

      this.set(`widget.listeners`, listeners)
    }

    for (let name in listeners) {
      let listener = listeners[name]

      this.listenEvent(name, (...args) => {
        Utils.logError(`calling listener ${name}`)
        listener.apply(this, args)
      })
    }

    {
      for (let name of this.MethodListeners) {
        this.listenComponentEvent(this.getId(), name, (...args) => {
          Utils.logError(`calling method listener ${name}`)
          this[name](...args)
        })
      }
    }
  }

  /**
   *
   */
  didInsertElement() {
    //super.didInsertElement(...arguments)

    //console.log(`didInsertElement`, this.getId(), this.get(`widget`))

    // is it root widget?
    let parent = this.getParent()
    if (parent && typeof parent.addChild === 'function') {
      parent.addChild(this)
    } else {
      this.getManager().addWidget(this)
    }

    let element = this.getElement()

    // Set specific class
    let componentName = this.getComponentName()
    if (componentName) {
      element.addClass(componentName)
    }

    this.applyMethods()
    this.applyEvents()
    this.applyListeners()

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
    super.willDestroy(...arguments)
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
    return false
  }

  mouseUp() {
    console.log(`mouseUp`)
    return false
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
    return false
  }

  async fetchAudio(id) {
    return `https://soundbible.com/mp3/Tyrannosaurus%20Rex%20Roar-SoundBible.com-807702404.mp3`
  }

  @action
  required(event) {
    if (!event.target.value) {
      this.set(`errors`, [...this.errors, {
        message: `${event.target.name} is required`
      }])
    }
  }

  @action
  async playAudio(id) {
    const audio = new Audio(await this.fetchAudio(id))
    await audio.play()
  }

}

export default setComponentTemplate(template, GuiWidget)
