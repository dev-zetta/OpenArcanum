import Application from '@ember/application'
import Resolver from './resolver'
import loadInitializers from 'ember-load-initializers'
import config from './config/environment'

const App = Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver,

  engines: {
    'game-core': {
      dependencies: {
        externalRoutes: {
          index: 'index'
        }
      }
    }
  }
})

loadInitializers(App, config.modulePrefix)

import AGate from './agate/AGate'
global.AGate = AGate

export default App
