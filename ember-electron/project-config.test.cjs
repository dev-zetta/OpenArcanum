'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const projectConfig = require('../config/project')
const configured = require('../config.json')
const root = path.resolve(__dirname, '..')

function withEnvironment(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]))
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    run()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

test('default project configuration preserves the retail data selection and authored GUI', () => {
  withEnvironment({ OPENARCANUM_MODULE: undefined, OPENARCANUM_DATA_PATH: undefined }, () => {
    const config = projectConfig()
    assert.equal(config.dataPath, path.resolve(root, configured.dataPath))
    assert.equal(config.scriptsPath, path.resolve(root, configured.scriptsPath))
    assert.equal(config.moduleId, undefined)
    assert.notEqual(config.authoredGui, false)
  })
  withEnvironment({ OPENARCANUM_MODULE: undefined, OPENARCANUM_DATA_PATH: './custom-retail' }, () => {
    assert.equal(projectConfig().dataPath, path.join(root, 'custom-retail'))
  })
})

test('inventory workshop selects only its bundled data and never inherits a retail data override', () => {
  withEnvironment({ OPENARCANUM_MODULE: 'inventory-workshop', OPENARCANUM_DATA_PATH: '/unrelated-retail' }, () => {
    const config = projectConfig()
    assert.equal(config.moduleId, 'inventory-workshop')
    assert.equal(config.developmentMap, 'Inventory workshop')
    assert.equal(config.dataPath, path.join(root, 'examples/inventory-workshop/data'))
    assert.equal(config.moduleManifestPath, path.join(root, 'examples/inventory-workshop/module.json'))
    assert.equal(config.checkpointPath, path.join(root, 'local-data/saves/inventory-workshop.json'))
    assert.equal(config.authoredGui, false)
  })
})

test('unknown bundled module names and path-like selections fail explicitly', () => {
  for (const moduleId of ['other-module', '../inventory-workshop', '/tmp/module', 'inventory-workshop ']) {
    withEnvironment({ OPENARCANUM_MODULE: moduleId }, () => assert.throws(projectConfig, /Unknown bundled module/))
  }
})
