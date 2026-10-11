'use strict'

const path = require('path')
const projectRoot = path.resolve(__dirname, '..')
const configured = require('../config.json')

module.exports = function projectConfig() {
  return Object.assign({}, configured, {
    dataPath: path.resolve(projectRoot, process.env.OPENARCANUM_DATA_PATH || configured.dataPath),
    scriptsPath: path.resolve(projectRoot, configured.scriptsPath)
  })
}
