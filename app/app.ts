import '@warp-drive/ember/install'
import Application from '@ember/application'
import Resolver from './resolver'
import loadInitializers from 'ember-load-initializers'
import config from './config/environment'
import compatModules from '@embroider/virtual/compat-modules'
import './styles/app.scss'
import 'leaflet/dist/leaflet.css'
import 'video.js/dist/video-js.css'
import 'jspanel4/dist/jspanel.css'

class App extends Application {
  modulePrefix = config.modulePrefix
  podModulePrefix = config.podModulePrefix
  Resolver = Resolver.withModules(compatModules)
}

loadInitializers(App, config.modulePrefix, compatModules)

export default App
