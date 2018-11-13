'use strict'

const EmberApp = require(`ember-cli/lib/broccoli/ember-app`)
let shim = require(`@html-next/flexi-layouts/lib/pod-templates-shim`)
shim(EmberApp)

let path = require(`path`)

//const Funnel = require(`broccoli-funnel`)

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    vendorFiles: {
      //'converse': 'node_modules/converse.js/dist/converse.min.js'
    },

    /*outputPaths: {
        app: {
            css: {
                'theme': 'assets/theme.css'//,
                //'gui-images': 'assets/gui-images.css'
            }
        }
    },*/
    babel: {
      //debug: true
      loose: false,
      //useBuiltIns: true,
      modules: false,
      targets: {
        node: `current`,
        uglify: false
      },

      plugins: [
        [`dynamic-import-node-babel-7`, { noInterop: false }],
        [`@babel/plugin-proposal-class-properties`, { loose: true }]
      ]
    },

    'ember-cli-babel': {
      compileModules: true
    },

    'ember-bootstrap': {
      bootstrapVersion: 4,
      importBootstrapFont: false,
      importBootstrapCSS: false
    }
  })

  let modulesDir = `node_modules`

  app.import(`node_modules/jspanel4/dist/jspanel.min.css`)
  //app.import(`node_modules/converse.js/css/converse.min.css`)

  app.import({
    development: path.join(modulesDir, `video.js/dist/video-js.css`),
    production: path.join(modulesDir, `video.js/dist/video-js.min.css`)
  })

  app.import(path.join(modulesDir, `video.js/dist/font/VideoJS.eot`), {
    destDir: `assets/font`
  })
  app.import(path.join(modulesDir, `video.js/dist/font/VideoJS.svg`), {
    destDir: `assets/font`
  })
  app.import(path.join(modulesDir, `video.js/dist/font/VideoJS.ttf`), {
    destDir: `assets/font`
  })
  app.import(path.join(modulesDir, `video.js/dist/font/VideoJS.woff`), {
    destDir: `assets/font`
  })

  app.import({
    development: path.join(modulesDir, `video.js/dist/video.js`),
    production: path.join(modulesDir, `video.js/dist/video.min.js`)
  })

  /*(options.languages || []).forEach(function(language) {
    app.import(path.join(app.bowerDirectory, 'video.js/dist/lang/' + language + '.js'));
  });*/

  app.import(path.join(modulesDir, `video.js/dist/video-js.swf`), {
    destDir: `assets`
  })
  return app.toTree()
}
