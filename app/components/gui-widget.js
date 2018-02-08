import Component from '@ember/component';
import {Engine} from '../agate/shared/Engine';
import {Manager} from '../agate/client/Gui';
import AGate from '../agate/agate';

export default Component.extend({
  store: Ember.inject.service(),
  classNames: ['gui-widget'],
  attributeBindings: ['draggable'],
  draggable: 'false',
  visible: true,

  init() {
    this._super(...arguments);
    this.children = new Map();
    this.cachedWidgets = new Map();
  },

  getElement() {
    if (!this.jElement)
      this.jElement = this.$();

    return this.jElement;
  },

  getParent() {
    return this.parentView;
    //return this.get('widget.parent');
  },

  getChildren() {
    return this.children;
   // return this.get('widget.components');
  },

  getWidget(id) {
    let widget = this.cachedWidgets.get(id);

    if (widget)
      return widget;

    widget = this.getManager().findWidget(id);

    this.cachedWidgets.set(id, widget);
    return widget;
  },

  addChild(child) {
    let id = child.getId();
    this.children.set(id, child);
  },

  getChild(id) {
    return this.getManager().findWidget(id, this.children);
  },

  createChildModel(definition) {
    let store = this.get('store');

    definition = Object.assign({parent: this.get('widget')}, definition)
    store.createRecord('gui-widget', definition);

    let model = store.peekRecord('gui-widget', definition.id);
    return model;
  },

  createModelsForChildren(definition) {
    let id = this.getId();

    for (let key in definition) {
      let widget = Object.assign({
        'id': `${id}:${key}`,
      }, definition[key]);

      let model = this.createChildModel(widget);

      this.set(key, model);
    }
  },

  createChild(definition) {
    let model = this.createChildModel(definition);

    this.get('widget.components').pushObject(model);
    return model;
  },


  emitEvent(name, ...args) {
    this.getEngine().events.emit(`ui.${name}`, ...args);
  },

  listenEvent(name, listener) {
    this.getEngine().events.on(`ui.${name}`, listener);
  },

  listenEventOnce(name, listener) {
    this.getEngine().events.once(`ui.${name}`, listener);
  },

  emitOwnEvent(name, ...args) {
    let events = this.get('widget.events');
    if(!events)
      return false;

    let method = events[name];
    if (!AGate.Utils.isFunction(method))
      return false;

      method.call(this, ...args);
  },

  getEngine() {
    return Engine.instance;
  },

  getClient() {
    return this.getEngine().client;
  },

  getManager() {
    return this.getEngine().client.guiManager;
  },

  getId() {
    return this.get('widget.id');
  },

  isVisible() {
    return this.get('widget.visible'); //his.getElement().is(':visible');
  },

  setVisibility(visible, fade = false) {
    if (fade) {
      if (visible)
        this.getElement().fadeIn();
      else this.getElement().fadeOut();
    }

    this.set('widget.visible', visible);
  },

  toggleVisibility() {
    this.setVisibility(!this.get('widget.visible'));
  },

  getPosition() {
    return this.get('widget.position');
  },

  setPosition(left, top) {
    this.set('widget.position', {left: left, top: top});

    this.setStyle({left: `${left}px`, top: `${top}px`});
  },

  getSize() {
    return this.get('widget.size');
  },

  setSize(width, height) {
    let element = this.getElement();

    if (element) {
      this.set('widget.size', {width: width, height: height});

      this.setStyle({width: `${width}px`, height: `${height}px`});

      element.outerWidth(`${width}px`);
      element.outerHeight(`${height}px`);

    } else {
      // Called before DirInsertElement
      this._super(...arguments);
    }
  },

  setStyle(style) {
    let element = this.getElement();

    if (AGate.Utils.isString(style))
      element.attr("style", element.attr("style") + "; " + style);
    else element.css(style);
  },

  getSprite() {
    return this.get('widget.sprite');
  },

  setSprite(key) {
    let element = this.getElement();

    let sprite = this.getSpriteByKey(key);
    if (AGate.Utils.isUndefined(sprite)) {
      AGate.Utils.logError(sprite);
      return false;
    }

    let previous = this.getSprite();
    if (AGate.Utils.isObjectLike(previous)) {
      element.removeClass(previous.className);
    }

    element.addClass(sprite.className);

    let size = this.getSize();
    if (!size) {
      let frame = sprite.getFrame();
      this.setSize(frame.width, frame.height);
    }

    this.set('widget.sprite', sprite);
  },

  getSpriteByKey(key) {
    let guiManager = this.getManager();

    let sprite = guiManager.getSprite(key);
    return sprite;
  },

  startAnimation(name, options = {}, onFinish = null) {
    let sprite = this.getSprite();
    let keyframes = [];

    /*sprite.frames.forEach((frame, index) => {
      keyframes[index] = {
        backgroundPosition: `-${frame.left}px 0px`
      };
    });*/

    let timing = {
      duration: AGate.Utils.isNumber(options.duration) ? options.duration : 1000,
      iterations: (options.repeat < 0) ? Infinity : AGate.Utils.isNumber(options.repeat) ? options.repeat : 1,
      //
      //playbackRate: 100
    };

    switch (name){
      case 'glow': {
        keyframes.push({
          boxShadow: `0px 0px 10px 4px rgba(255,187,0,0.62)`
        });

        keyframes.push({
          boxShadow: `0px 0px 20px 8px rgba(0,187,0,0.62)`
        });

        keyframes.push({
          boxShadow: `0px 0px 10px 4px rgba(255,187,0,0.62)`
        });

        timing.easing = `ease-in-out`;
        break;
      }
      case 'background': {
        let frame = sprite.getLastFrame();
        keyframes.push({
          backgroundPositionX: `-${frame.left + frame.width}px`
        });
        timing.easing = `steps(${sprite.getFrameCount()})`;
        break;
      }
      case 'show-in': {
        keyframes.push({
          scale: '0.0 0.0',
          opacity: 0.0,
          display: 'none',
          transform: 'translateY(-100%)'
        });

        keyframes.push({
          scale: '1.0 1.0',
          opacity: 1.0,
          display: 'block',
          transform: 'translateY(0%)'
        });

        timing.easing = 'ease-in-out';
        timing.fill = 'both';
        break;
      }
      case 'show-out': {
        keyframes.push({
          scale: '1.0 1.0',
          opacity: 1.0,
          display: 'block',
          transform: 'translateY(0%)'
        });

        keyframes.push({
          scale: '0.0 0.0',
          opacity: 0.0,
          display: 'none',
          transform: 'translateY(-50%)'
        });

        timing.easing = 'ease-in-out';
        timing.fill = 'both';
        break;
      }

    }

    // https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
    let anim = this.get('element').animate(keyframes, timing);
    if (onFinish)
      anim.onfinish = onFinish;

    return anim;
  },

  /**
   *
   * @param index
   * @returns {boolean}
   */
  changeFrame(index) {
    let sprite = this.getSprite();
    if (!sprite)
      return false;

    if (!sprite.hasFrame(index))
      index = 0;

    let frame = sprite.getFrame(index);

    let element = this.getElement();
    element.css('background-position', `-${frame.left}px -${frame.top}px`);

    return true;
  },

  /**
   *
   */
  didReceiveAttrs() {
    this._super(...arguments);

    /*const profile = this.get('data');
    if (typeof profile === 'string') {
      this.set('profile', JSON.parse(profile));
    } else {
      this.set('profile', profile);
    }*/

    let position = this.get('widget.position');
    if (AGate.Utils.isArray(position)) {
      position = {'left': position[0], 'top': position[1]};
      this.set('widget.position', position);
    }

    let size = this.get('widget.size');
    if (AGate.Utils.isArray(size)) {
      size = {'width': size[0], 'height': size[1]};
      this.set('widget.size', size);
    }

    let events = this.get('widget.events');
    if (AGate.Utils.isString(events)) {
      events = Manager.jsonToObject(events);
      this.set('widget.events', events);
    }

    let listeners = this.get('widget.listeners');
    if (AGate.Utils.isString(listeners)) {
      listeners = Manager.jsonToObject(listeners);

      this.set('widget.listeners', listeners);
    }

    for (let name in listeners) {
      let listener = listeners[name];
      this.listenEvent(name, (...args) => {listener.call(this, ...args);});
    }
  },

  /**
   *
   */
  didUpdateAttrs() {
    this._super(...arguments);
  },

  /**
   *
   */
  didInsertElement() {
    this._super(...arguments);

    // is it root widget?
    let parent = this.getParent();
    if (!parent.parentView) {
      let manager = this.getManager();
      manager.addWidget(this);
    }

    // add everything except game-render
    if (parent && parent.parentView) {
      parent.addChild(this);
    }

    let element = this.getElement();

    // Set specific class
    let componentName = this.get('widget.componentName');
    if (componentName)
      element.addClass(componentName);

    // Generate CSS style
    let style = {};

    let position = this.get('widget.position');
    if (position) {
      style['top'] = `${position.top}px`;
      style['left'] = `${position.left}px`;
    }

    // Set alignment
    let align = this.get('widget.align');
    if (align) {
      align = align.split('-');

      switch (align[0]) {
        case 'left':
          style['left'] = '0';
          style['right'] = 'auto';
          break;
        case 'right':
          style['right'] = '0';
          style['left'] = 'auto';
          break;
        case 'center':
          style['left'] = '50%';
          style['margin-left'] = function() {return -$(this).outerWidth()/2};
          break;
      }

      switch (align[align.length > 1 ? 1 : 0]) {
        case 'top':
          style['top'] = '0';
          break;
        case 'bottom':
          style['bottom'] = '0';
          break;
        case 'center':
          style['top'] = '50%';
          style['margin-top'] = function() {return -$(this).outerHeight()/2};
          break;
      }
    }

    // Set background sprite
    let size = this.get('widget.size');

    let spriteKey = this.get('widget.sprite');
    if (spriteKey) {
      this.setSprite(spriteKey);
    }

    // set size
    if (size) {
      this.setSize(size.width, size.height);
    }

    // set visibility
    let visible = this.get('widget.visible');
    if (!AGate.Utils.isUndefined(visible)) {
      //style['visibility'] = visible ? 'visible' : 'hidden';
      this.setVisibility(visible);
    }

    this.setStyle(style);

    // Set user-defined style
    let rawStyle = this.get('widget.style');
    if (rawStyle) {
      this.setStyle(rawStyle);
    }

    // add user-defined classes
    let prototype = this.get('widget.prototype');
    if (prototype) {
      element.addClass(prototype);
    }

    this.emitOwnEvent('created');
  },

  didDestroyElement() {

  },

  didRender() {
    this._super(...arguments);

    let animation = this.get('widget.animation');
    if (animation)
     this.startAnimation('background', animation);

  },

  willDestroyElement() {
    this._super(...arguments);
    this.$().off('animationend');

  },

  dragStart(e) {
    e.preventDefault();
    return false;
  },

  dragOver() {
    return false;
  },

  drop(e) {
    //let id = event.dataTransfer.getData('text/data');
    //this.get('action')(id);
  },

  click() {
    this.startAnimation('glow', {
      'duration': 1000,
    });
  },

  actions: {
    required(event) {
      if (!event.target.value) {
        this.get('errors').pushObject({ message: `${event.target.name} is required`});
      }
    }
  }
});
