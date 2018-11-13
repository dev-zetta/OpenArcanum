import EmberRouter from '@ember/routing/router'
import config from './config/environment'

import { setupRouter, reset } from 'ember-app-scheduler'

class Router extends EmberRouter {
  location = config.locationType
  rootURL = config.rootURL

  constructor() {
    super(...arguments)

    setupRouter(this)
  }

  destroy() {
    reset()

    super.destroy(...arguments)
  }
}

Router.map(function() {
  // this.route('index', { path: '/' });
  this.route(`ingame`)
  this.mount(`game-core`)
})

export default Router
