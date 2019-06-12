'use strict'

const EmberApp = require(`ember-cli/lib/broccoli/ember-app`)
let shim = require(`@html-next/flexi-layouts/lib/pod-templates-shim`)
shim(EmberApp)

let path = require(`path`)

//const Funnel = require(`broccoli-funnel`)

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    hinting: false,
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
      debug: false,
      //loose: false,
      //useBuiltIns: 'entry',
      //modules: false,
      plugins: [
        //"@babel/plugin-transform-flow-strip-types"
        "@babel/plugin-syntax-dynamic-import"
      ]
    },

    /*'ember-cli-babel': {
      compileModules: true
    },*/

    'ember-bootstrap': {
      bootstrapVersion: 4,
      importBootstrapFont: false,
      importBootstrapCSS: false
    }
  })

  let modulesDir = `node_modules`

  app.import(`${modulesDir}/jspanel4/dist/jspanel.min.css`)

  /*app.import(path.join(modulesDir, `@openarcanum/agate/src/main.js`), {
    using: [
      { transformation: 'cjs', as: '@openarcanum/agate' }
    ]
  });*/

  /*app.import(path.join(modulesDir, `@stdlib/stdlib/index.js`), {
    using: [
      { transformation: 'cjs', as: '@stdlib/stdlib' }
    ]
  });

  app.import(path.join(modulesDir, `vec2/vec2.js`), {
    using: [
      { transformation: 'cjs', as: 'vec2' }
    ]
  });

  app.import(path.join(modulesDir, `xorshift/xorshift.js`), {
    using: [
      { transformation: 'cjs', as: 'xorshift' }
    ]
  });

  app.import(path.join(modulesDir, `realm/lib/index.js`), {
    using: [
      { transformation: 'cjs', as: 'realm' }
    ]
  });*/


  //app.import(`node_modules/converse.js/css/converse.min.css`)
 /* app.import(path.join(modulesDir, `cash-dom/dist/cash.js`), {
    using: [{transformation: `cjs`, as: `cash` }],
    //development: ,
    //production: path.join(modulesDir, `cash-dom/dist/cash.min.js`)
  })*/

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
