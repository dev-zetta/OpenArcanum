'use strict'

const config = require('../config.json')

module.exports = function(environment) {
  let ENV = {
    modulePrefix: `open-arcanum`,
    podModulePrefix: `open-arcanum/pods`,
    environment,
    rootURL: `/`,
    locationType: `auto`,
    vendorFiles: { 'jquery.js': null },


    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: {
        // Prevent Ember Data from overriding Date.parse.
        Date: false
      }
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    },

    EmberHammertime: {
      touchActionOnAction: true,
      touchActionAttributes: [`onclick`],
      touchActionSelectors: [`button`, `input`, `a`, `textarea`],
      touchActionProperties: `touch-action: manipulation; -ms-touch-action: manipulation;`
    },

    resizeServiceDefaults: {
      debounceTimeout: 200,
      heightSensitive: true,
      widthSensitive: true,
      injectionFactories: [`view`, `component`]
    }
  }

  if (environment === `development`) {
    ENV.APP.LOG_RESOLVER = true
    ENV.APP.LOG_ACTIVE_GENERATION = true
    ENV.APP.LOG_TRANSITIONS = true
    ENV.APP.LOG_TRANSITIONS_INTERNAL = true
    ENV.APP.LOG_VIEW_LOOKUPS = true
  }

  if (environment === `test`) {
    // Testem prefers this...
    ENV.locationType = `none`

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false
    ENV.APP.LOG_VIEW_LOOKUPS = false

    ENV.APP.rootElement = `#ember-testing`
  }

  if (environment === `production`) {
    // here you can enable a production-specific feature
  }

  /*ENV['ember-component-css'] = {
    namespacing: false
  }*/

  ENV.AGate = config

  return ENV
}
