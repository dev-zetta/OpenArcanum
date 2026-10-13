'use strict'

const path = require('node:path') as typeof import('node:path')
const projectRoot = path.resolve(__dirname, '..')
const configured = require('../config.json') as import('../ember-electron/desktop-contracts.cjs').ProjectConfig

module.exports = function projectConfig() {
  const moduleId = process.env.OPENARCANUM_MODULE
  if (moduleId && moduleId !== 'inventory-workshop') throw new Error(`Unknown bundled module: ${moduleId}`)
  if (moduleId === 'inventory-workshop') {
    // This is one reviewed, bundled data module, not a path or script loader.
    return Object.assign({}, configured, {
      moduleId,
      authoredGui: false,
      developmentMap: 'Inventory workshop',
      moduleManifestPath: path.join(projectRoot, 'examples/inventory-workshop/module.json'),
      dataPath: path.join(projectRoot, 'examples/inventory-workshop/data'),
      checkpointPath: path.join(projectRoot, 'local-data/saves/inventory-workshop.json'),
      scriptsPath: path.resolve(projectRoot, configured.scriptsPath)
    })
  }
  return Object.assign({}, configured, {
    dataPath: path.resolve(projectRoot, process.env.OPENARCANUM_DATA_PATH || configured.dataPath),
    scriptsPath: path.resolve(projectRoot, configured.scriptsPath)
  })
}
