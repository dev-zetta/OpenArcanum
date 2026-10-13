'use strict'

// Runtime paths are resolved in Electron's preload, not baked into UI artifacts.
const config = require('../config.json') as import('../ember-electron/desktop-contracts.cjs').ProjectConfig

module.exports = function(environment: string) {
  let ENV: { modulePrefix: string; podModulePrefix: string; environment: string; rootURL: string; locationType: string; EmberENV: { FEATURES: Record<string, boolean>; EXTEND_PROTOTYPES: boolean }; APP: Record<string, unknown>; AGate?: unknown } = {
    modulePrefix: `open-arcanum`,
    podModulePrefix: `open-arcanum/pods`,
    environment,
    rootURL: `/`,
    locationType: `hash`,

    EmberENV: {
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. 'with-controller': true
      },
      EXTEND_PROTOTYPES: false
    },

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    }
  }

  if (environment === `development`) {
    ENV.APP.LOG_TRANSITIONS = false
  }

  if (environment === `test`) {
    // Testem prefers this...
    ENV.locationType = `none`

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false
    ENV.APP.LOG_VIEW_LOOKUPS = false

    ENV.APP.rootElement = `#ember-testing`
    ENV.APP.autoboot = false
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
