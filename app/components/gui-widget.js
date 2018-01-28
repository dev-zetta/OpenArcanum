import Component from '@ember/component';
import {Engine} from '../agate/shared/Engine';

export default Component.extend({
  classNames: ['gui-widget'],
  //attributeBindings: ['draggable'],
  //draggable: 'true',

  init() {
    this._super(...arguments);
  },

  getElement() {
    return this.$();
  },

  getManager() {
    return Engine.instance.guiManager;
  },

  changeFrame(index) {
    let sprite = this.get('sprite');
    if (!sprite)
      return false;

    if (!sprite.hasFrame(index))
      index = 0;

    let frame = sprite.getFrame(index);


    let element = this.getElement();

    element.css('background-position', `-${frame.left}px -${frame.top}px`);

    return true;
  },

  didReceiveAttrs() {
    this._super(...arguments);
    const profile = this.get('data');
    if (typeof profile === 'string') {
      this.set('profile', JSON.parse(profile));
    } else {
      this.set('profile', profile);
    }
  },

  didUpdateAttrs() {
    this._super(...arguments);
  },

  didInsertElement() {
    this._super(...arguments);
    let element = this.getElement();

    // Set specific class
    let componentName = this.get('widget.componentName');
    element.addClass(componentName);

    // Generate CSS style
    let style = {};

    let position = this.get('widget.position');
    if (position) {
      style['top'] = `${position.top}px`;
      style['left'] = `${position.left}px`;
    }

    let align = this.get('widget.align');

    if (align) {
      switch (align) {
        case 'top-center':
          style['top'] = '0';
          style['left'] = '50%';
          style['margin-left'] = function() {return -$(this).outerWidth()/2};
          break;
        case 'bottom-center':
          style['bottom'] = '0';
          style['left'] = '50%';

          style['margin-left'] = function() {return -$(this).outerWidth()/2};
          break;
      }
    }

    let spriteKey = this.get('widget.sprite');
    if (spriteKey) {
      let guiManager = this.getManager();

      let sprite = guiManager.getSprite(spriteKey);
      if (sprite) {
        this.set('sprite', sprite);

        element.addClass(sprite.className);

        let frame = sprite.getFrame();
        element.outerWidth(`${frame.width}px`);
        element.outerHeight(`${frame.height}px`);
      } else {
        console.log(spriteKey);
      }
    } else {
      let size = this.get('widget.size');

      if (size) {
        element.width(`${size.width}px`);
        element.height(`${size.height}px`);
      }
    }

    element.css(style);

  },

  didRender() {
    this._super(...arguments);
    //this.$('.item-list').scrollTop(this.$('.selected-item').position.top);
  },

  willDestroyElement() {
    this._super(...arguments);
    this.$().off('animationend');
    //this.$('input.date').myDatepickerLib().destroy();
  },

  dragOver() {
    return false;
  },

  drop(event) {
    let id = event.dataTransfer.getData('text/data');
    this.get('action')(id);
  },

  click() {

  },

  actions: {
    required(event) {
      if (!event.target.value) {
        this.get('errors').pushObject({ message: `${event.target.name} is required`});
      }
    }
  }
});
