import Component from '@ember/component';
import { Engine } from '../agate/shared/Engine';

export default Component.extend({
    classNames: ['game-render'],
    value: '',

    init() {
      this._super(...arguments)
    },

    didInsertElement() {
        this._super(...arguments)

        let canvas = document.getElementById("render2d")
        this._engine = new Engine(canvas)
    },

    actions: {

    }
});
