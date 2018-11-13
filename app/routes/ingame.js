import Route from '@ember/routing/route'
import { whenRouteIdle, whenRoutePainted } from 'ember-app-scheduler'

import {service} from '@ember-decorators/service'

import Ember from 'ember'

const { set } = Ember

export default class IngameRoute extends Route {
  @service
  headData

  activate() {
    super.activate(...arguments)

    whenRouteIdle().then(() => {
      // do non-critical work
    })

    whenRoutePainted().then(() => {
      // do work that needs to occur between the route being painted
      // and `whenRouteIdle`
    })
  }

  afterModel() {
    set(this, `headData.title`, `OpenArcanum`)
    set(this, `headData.css`, `asset://gui/gui-images.css`)


  }

  /*model() {
    return this.get('store').query('gui-widget', {
      include: 'components',
      filter: {
        type: 'window'
      }
    });
  }*/
}
