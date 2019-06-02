/*require = require("esm")(module, {
  cache: true
})*/

if (!global.process) {
  global.process = process
}
const path = require(`path`)

require(`@babel/register`)({
  extends: path.dirname(__filename) + `/../.babelrc`,
  ignore: [/node_modules/, /vendor/],
  extensions: [`.es6`, `.es`, `.jsx`, `.js`, `.mjs`],
  cache: true
})

const fs = require(`fs`)

require.extensions[`.glsl`] = function(module, filename) {
  module.exports = fs.readFileSync(filename, `utf8`)
}

const AGate = require(`./AGate`).default

module.exports = AGate
