import Component, { setComponentTemplate } from '@ember/component'
import { service } from '@ember/service'
import { action, computed } from '@ember/object'
import Store from '@ember-data/store'
import cash, { type Cash } from 'cash-dom'
import template from './layout.hbs'
import { getAGate, utils as Utils } from 'open-arcanum/lib/runtime'
import type GuiWidgetModel from '../../../models/gui-widget'
import type { CssDimension, WidgetDefinition, WidgetOptions, WidgetPosition, WidgetSize, WidgetStyle, WidgetHooks, WidgetCallback, WidgetAnimation, GuiSprite } from '../../../types/widgets'

const getWidgetClass = (type: string, dot = false): string => dot ? `.gui-${type}` : `gui-${type}`

class GuiWidget extends Component {
  classNames = ['gui-widget']
  attributeBindings = ['dataId:data-id', 'tooltip:title']
  default: WidgetDefinition = { type: 'widget', options: {} }
  declare widget: GuiWidgetModel
  // The outer GameRender host supplies itself here, while nested widgets
  // supply their owning GuiWidget. Only the latter owns a child registry.
  declare parentWidget?: Component
  @service declare store: Store
  errors: { message: string }[] = []
  visible = true
  sprite: GuiSprite | null = null
  MethodListeners = ['show', 'hide', 'toggle'] as const
  children = new Map<string, GuiWidget>()
  cachedWidgets = new Map<string, GuiWidget>()
  cashElement?: Cash
  getWidgetClass = getWidgetClass
  textState?: 'pending' | 'resolved' | 'rejected'

  @computed('widget.options.tooltip') get tooltip(): string | undefined { return this.widget?.options?.tooltip }
  @computed('widget.id', 'widget.name') get dataId(): string | number { return this.getId() || 0 }

  getElement(): Cash {
    if (!this.cashElement && this.element) this.cashElement = cash(this.element)
    return this.cashElement || cash()
  }
  getParent(): GuiWidget | undefined {
    const parent = this.parentWidget || this.parentView
    return parent instanceof GuiWidget ? parent : undefined
  }
  getChildren(): Map<string, GuiWidget> { return this.children }
  getWidget(id: string): GuiWidget | undefined {
    let widget = this.cachedWidgets.get(id)
    if (!widget) {
      widget = this.getManager().findWidget(id)
      if (widget) this.cachedWidgets.set(id, widget)
    }
    return widget
  }
  addChild(child: GuiWidget): void { this.children.set(child.getId(), child) }
  getChild(id: string): GuiWidget | undefined { return this.getManager().findWidget(id, this.children) }
  getStore(): Store { return this.store }
  getOptions(): WidgetOptions { return this.widget?.options || {} }
  getOption<K extends keyof WidgetOptions>(name: K): WidgetOptions[K] { return this.getOptions()[name] }
  makeChildId(key: string): string { return `${this.getId()}.${key}` }
  createModel(definition: WidgetDefinition): GuiWidgetModel {
    const store = this.getStore()
    let model = definition.id ? store.peekRecord<GuiWidgetModel>('gui-widget', definition.id) : null
    if (model) {
      for (const [property, value] of Object.entries(definition)) Reflect.set(model, property, value)
      return model
    }
    const { components: _components, parent, ...attributes } = definition
    return store.createRecord<GuiWidgetModel>('gui-widget', { ...attributes, parent: typeof parent === 'string' ? undefined : parent })
  }
  createChildModel(definition: WidgetDefinition): GuiWidgetModel { return this.createModel({ parent: this.widget, ...definition }) }
  createModelsForChildren(definitions: Record<string, WidgetDefinition>): void {
    for (const [key, definition] of Object.entries(definitions)) {
      const model = this.createChildModel({ id: this.makeChildId(key), ...definition })
      this.set(key as keyof this, model as this[keyof this])
    }
  }
  createChildren(definitions: Record<string, WidgetDefinition>): void {
    for (const [key, definition] of Object.entries(definitions)) this.createChild({ id: this.makeChildId(key), ...definition })
  }
  createChild(definition: WidgetDefinition): GuiWidgetModel { return this.createChildModel(definition) }
  callComponent(id: string, method: string, ...args: unknown[]): void {
    const widget = this.getWidget(id)
    if (!widget) {
      this.listenComponentEventOnce(id, 'created', () => this.callComponent(id, method, ...args))
      Utils.logError(`Component ${id} not found`, widget)
      return
    }
    this.callMethod(widget, method, args)
  }
  callMethod(widget: GuiWidget, method: string, args: unknown[]): void {
    const callback = widget.getMethods()[method]
    if (typeof callback === 'function') callback.apply(widget, [this, ...args])
  }
  private resolveEvent(name: string): string { return name.startsWith(':') ? `${this.getId()}${name}` : name }
  emitEvent(name: string, ...args: unknown[]): void { this.getClient().emitUI(this.resolveEvent(name), ...args) }
  listenEvent(name: string, listener: (...args: unknown[]) => unknown): void { this.getClient().listenUI(this.resolveEvent(name), listener) }
  listenEventOnce(name: string, listener: (...args: unknown[]) => unknown): void { this.getClient().listenOnceUI(name, listener) }
  emitComponentEvent(id: string, name: string, ...args: unknown[]): void { this.getClient().emitUI(`${id}:${name}`, ...args) }
  listenComponentEvent(id: string, name: string, listener: (...args: unknown[]) => unknown, context?: unknown): void { this.getClient().listenUI(`${id}:${name}`, listener, context) }
  listenComponentEventOnce(id: string, name: string, listener: (...args: unknown[]) => unknown, context?: unknown): void { this.getClient().listenOnceUI(`${id}:${name}`, listener, context) }
  emitOwnEvent(name: string, ...args: unknown[]): void {
    this.getEvents()[name]?.apply(this, args)
    this.emitComponentEvent(this.getId(), name)
  }
  getComponentName(): string { return this.widget.componentName }
  private hooks(value: WidgetHooks | string | null): WidgetHooks { return typeof value === 'string' ? Utils.jsonToObject<WidgetHooks>(value) : value || {} }
  getEvents(): WidgetHooks { return this.hooks(this.widget.events) }
  getListeners(): WidgetHooks { return this.hooks(this.widget.listeners) }
  getMethods(): WidgetHooks { return this.hooks(this.widget.methods) }
  getEngine() {
    const engine = getAGate()?.engine
    if (!engine) throw new Error('GUI widgets require an initialized game engine.')
    return engine
  }
  getClient() {
    const client = this.getEngine().client
    if (!client) throw new Error('GUI widgets require an initialized game client.')
    return client
  }
  getManager() { return this.getClient().guiManager }
  getDatabase(): unknown { return this.getEngine().database }
  getId(): string { return this.widget?.name || this.widget?.id || '' }
  isHidden(): boolean { return !this.widget.visible }
  setVisibility(visible: boolean): void {
    this.getElement().css({ display: visible ? 'block' : 'none' })
    if (visible) this.bringToFront()
    this.emitOwnEvent(visible ? 'shown' : 'hidden')
    this.widget.set('visible', visible)
  }
  toggleVisibility(): void { this.setVisibility(!this.widget.visible) }
  show(): void { if (this.isHidden()) this.setVisibility(true) }
  hide(): void { if (!this.isHidden()) this.setVisibility(false) }
  toggle(): void { this.setVisibility(this.isHidden()) }
  showWithAnim(animation = 'show-in'): void { if (this.isHidden()) this.startAnimation(animation, {}, () => this.setVisibility(true)) }
  hideWithAnim(animation = 'show-out'): void { if (!this.isHidden()) this.startAnimation(animation, {}, () => this.setVisibility(false)) }
  toggleWithAnim(animation = ['show-in', 'show-out']): void {
    const visible = !this.isHidden()
    this.startAnimation(visible ? animation[1] : animation[0], {}, () => this.setVisibility(!visible))
  }
  bringToFront(): void { this.getElement().css('z-index', '999') }
  bringToBack(): void { this.getElement().css('z-index', '0') }
  getPosition(): WidgetPosition | string | null {
    const position = this.widget.position
    return Array.isArray(position) ? { left: position[0], top: position[1] } : position
  }
  setPosition(left: CssDimension, top: CssDimension): void {
    this.widget.set('position', { left, top })
    this.setStyle({ left: `${left}px`, top: `${top}px` })
  }
  getSize(): WidgetSize | null {
    const size = this.widget.size
    return Array.isArray(size) ? { width: size[0], height: size[1] } : size
  }
  setSize(width: CssDimension, height: CssDimension): void {
    this.widget.set('size', { width, height })
    const cssWidth = typeof width === 'number' ? `${width}px` : width
    const cssHeight = typeof height === 'number' ? `${height}px` : height
    this.setStyle({ width: cssWidth, height: cssHeight })
    this.getElement().css({ width: cssWidth, height: cssHeight })
  }
  setStyle(style: WidgetStyle | string): void {
    const element = this.getElement()
    if (typeof style === 'string') element.attr('style', `${element.attr('style') || ''}; ${style}`)
    else element.css(Object.fromEntries(Object.entries(style).filter((entry): entry is [string, string | number] => entry[1] !== undefined)))
  }
  getSpriteKey(): string | null { return this.widget.sprite }
  setSpriteKey(key: string): void { this.widget.set('sprite', key) }
  getSprite(): GuiSprite | null { return this.sprite }
  setSprite(key: string): boolean {
    const sprite = this.getSpriteByKey(key)
    if (!sprite) { Utils.logError('Unable to find sprite: ', key); return false }
    const element = this.getElement()
    this.sprite?.detachFromElement(element)
    sprite.attachToElement(element)
    if (!this.getSize()) { const frame = sprite.getFrame(); this.setSize(frame.width, frame.height) }
    this.set('sprite', sprite)
    return true
  }
  getSpriteByKey(key: string): GuiSprite | undefined { return this.getManager().getSprite(key) }
  startAnimation(name: string, options: WidgetAnimation = {}, onFinish: (() => void) | null = null): Animation {
    const keyframes: Keyframe[] = []
    const timing: KeyframeAnimationOptions = { duration: options.duration ?? 1000, iterations: (options.repeat ?? 1) < 0 ? Infinity : options.repeat ?? 1 }
    switch (name) {
      case 'glow':
        keyframes.push({ boxShadow: '0px 0px 10px 4px rgba(255,187,0,0.62)' }, { boxShadow: '0px 0px 20px 8px rgba(0,187,0,0.62)' }, { boxShadow: '0px 0px 10px 4px rgba(255,187,0,0.62)' })
        timing.easing = 'ease-in-out'; break
      case 'background': {
        const sprite = this.getSprite()
        if (sprite) { const frame = sprite.getLastFrame(); keyframes.push({ backgroundPositionX: `-${frame.left + frame.width}px` }); timing.easing = `steps(${sprite.getFrameCount()})` }
        break
      }
      case 'show-in':
        keyframes.push({ scale: '0.0 0.0', opacity: 0, display: 'none', transform: 'translateY(-100%)' }, { scale: '1.0 1.0', opacity: 1, display: 'block', transform: 'translateY(0%)' })
        timing.easing = 'ease-in-out'; timing.fill = 'both'; break
      case 'show-out':
        keyframes.push({ scale: '1.0 1.0', opacity: 1, display: 'block', transform: 'translateY(0%)' }, { scale: '0.0 0.0', opacity: 0, display: 'none', transform: 'translateY(-50%)' })
        timing.easing = 'ease-in-out'; timing.fill = 'both'; break
    }
    const animation = this.element!.animate(keyframes, timing)
    if (onFinish) animation.onfinish = onFinish
    return animation
  }
  changeFrame(index: number): boolean {
    const sprite = this.sprite
    if (!sprite) return false
    const frame = sprite.getFrame(sprite.hasFrame(index) ? index : 0)
    this.getElement().css('background-position', `-${frame.left}px -${frame.top}px`)
    this.setSize(frame.width, frame.height)
    return true
  }
  getRandomId(): string { return crypto.randomUUID() }
  didReceiveAttrs(): void {
    if (!this.widget) this.set('widget', this.createModel({ ...this.default, id: this.getRandomId() }))
    if (Array.isArray(this.widget.position)) this.widget.set('position', { left: this.widget.position[0], top: this.widget.position[1] })
    if (Array.isArray(this.widget.size)) this.widget.set('size', { width: this.widget.size[0], height: this.widget.size[1] })
    this.updateWidgetAttrs()
  }
  applyPosition(): void {
    const position = this.getPosition()
    if (!position) return
    const style: WidgetStyle = {}
    if (typeof position === 'string') {
      const align = position.split('-')
      switch (align[0]) {
        case 'left': style.left = '0'; style.right = 'auto'; break
        case 'right': style.right = '0'; style.left = 'auto'; break
        case 'center': style.left = '0'; style.right = '0'; style['margin-left'] = 'auto'; style['margin-right'] = 'auto'; break
      }
      switch (align.length > 1 ? align[1] : align[0]) {
        case 'top': style.top = '0'; break
        case 'bottom': style.bottom = '0'; break
        case 'center': style.top = '0'; style.bottom = '0'; style['margin-top'] = 'auto'; style['margin-bottom'] = 'auto'; break
      }
    } else { style.top = typeof position.top === 'number' ? `${position.top}px` : position.top; style.left = typeof position.left === 'number' ? `${position.left}px` : position.left }
    this.setStyle(style)
  }
  applySize(): void { const size = this.getSize(); if (size) this.setSize(size.width, size.height) }
  applySprite(): void { const key = this.getSpriteKey(); if (key) this.setSprite(key) }
  applyVisibility(): void { if (typeof this.widget.visible === 'boolean') this.setVisibility(this.widget.visible) }
  applyPrototype(): void { if (this.widget.prototype) this.getElement().addClass(this.widget.prototype) }
  applyStyle(): void { if (this.widget.style) this.setStyle(this.widget.style) }
  updateWidgetAttrs(): void {
    if (!this.element) return
    this.applyPosition(); this.applySize(); this.applySprite(); this.applyVisibility(); this.applyStyle(); this.applyPrototype()
  }
  applyMethods(): void { for (const [name, method] of Object.entries(this.getMethods())) Reflect.set(this, name, method.bind(this, this)) }
  applyEvents(): void { if (typeof this.widget.events === 'string') this.widget.set('events', this.getEvents()) }
  applyListeners(): void {
    for (const [name, listener] of Object.entries(this.getListeners())) this.listenEvent(name, (...args) => listener.apply(this, args))
    for (const name of this.MethodListeners) this.listenComponentEvent(this.getId(), name, (...args) => Reflect.apply(this[name], this, args))
  }
  didInsertElement(): this {
    const parent = this.getParent()
    if (parent) parent.addChild(this); else this.getManager().addWidget(this)
    if (this.getComponentName()) this.getElement().addClass(this.getComponentName())
    this.applyMethods(); this.applyEvents(); this.applyListeners(); this.updateWidgetAttrs(); this.emitOwnEvent('created')
    return this
  }
  didDestroyElement(): this { console.log('didDestroyElement', this.getId()); return this }
  didRender(): void { if (this.widget.animation) this.startAnimation('background', this.widget.animation) }
  willDestroyElement(): this { return this }
  drag(_event: DragEvent): boolean { console.error('drag'); return false }
  dragStart(_event: DragEvent): boolean { console.error('dragStart'); return false }
  dragOver(): boolean { console.error('dragOver'); return false }
  drop(_event: DragEvent): void { console.error('drop') }
  mouseDown(_event?: MouseEvent): boolean { console.log('mouseDown'); return false }
  mouseUp(): boolean { console.log('mouseUp'); return false }
  click(_event?: MouseEvent): boolean | undefined { this.emitOwnEvent('click'); return false }
  setValue(value: unknown): void { this.widget.set('value', value) }
  async fetchAudio(_id: string): Promise<string> { return 'https://soundbible.com/mp3/Tyrannosaurus%20Rex%20Roar-SoundBible.com-807702404.mp3' }
  @action required(event: Event): void {
    const target = event.target
    if (target instanceof HTMLInputElement && !target.value) this.set('errors', [...this.errors, { message: `${target.name} is required` }])
  }
  @action async playAudio(id: string): Promise<void> { await new Audio(await this.fetchAudio(id)).play() }
}
setComponentTemplate(template, GuiWidget)
export default GuiWidget
