import Application from '@ember/application'
import Resolver from './resolver'
import loadInitializers from 'ember-load-initializers'
import config from './config/environment'

//import AGate from '@openarcanum/agate'
const AGate = requireNode('@openarcanum/agate')
global.AGate = new AGate(config.AGate)

const App = Application.extend({
  LOG_TRANSITIONS: false,
  LOG_TRANSITIONS_INTERNAL: false,

  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver,

  /*engines: {
    'game-core': {
      dependencies: {
        externalRoutes: {
          index: `index`
        }
      }
    }
  }*/
})

loadInitializers(App, config.modulePrefix)

export default App
