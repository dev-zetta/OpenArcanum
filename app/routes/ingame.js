import Route from '@ember/routing/route'
import { whenRouteIdle, whenRoutePainted } from 'ember-app-scheduler'

import { inject as service } from '@ember/service'
import { set } from '@ember/object'

//import AGate from '.AGate'
//import config from '../config/environment'

//const AGate = require('@openarcanum/agate')
//const AGate = require('../../@openarcanum/agate/src/AGate').default

export default class IngameRoute extends Route {
  @service headData

  activate() {

    super.activate(...arguments)
    //global.AGate = new AGate(config.AGate)


    whenRouteIdle().then(() => {
      // do non-critical work

    })

    whenRoutePainted().then(() => {
      // do work that needs to occur between the route being painted
      // and `whenRouteIdle`
    })
  }

  afterModel(resolvedModel, transition) {
    set(this, `headData.title`, `OpenArcanum`)
    set(this, `headData.css`, `asset://gui/gui-images.css`)
  }

  model() {
    return this.get('store').query('gui-widget', {
      include: 'components',
      filter: {
        type: 'window'
      }
    });
  }
}
