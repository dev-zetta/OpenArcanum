'use strict'

let path = require(`path`)
let EventEmitter = require(`events`).EventEmitter

let ee = new EventEmitter()

// works like require
// example:
// root.js requires lib/reload-require.js
// root.js calls reload("./hello.js") → this refers to /hello.js, not /lib/hello.js
// in reload-require.js we *must* have this information, given by root.js's module.filename
// this is why we have to inject it
module.exports = function(parentModule) {
  let parentDir = path.dirname(parentModule.filename)

  function reload(file) {
    let modPath = resolve(parentDir, file)
    // Flush cache
    delete require.cache[modPath]
    // Ready to be reloaded on demand
    ee.emit(`reload`, modPath)
    // Emit custom event for specific file
    ee.emit(`reload:` + modPath)
  }

  reload.watch = function(file, callback) {
    let modPath = resolve(parentDir, file)

    let prev
    let curr = require(modPath) // grab initial version
    callback(prev, curr)

    ee.on(`reload:` + modPath, function() {
      prev = curr
      curr = require(modPath) // grab new version
      callback(prev, curr)
    })
  }

  reload.require = function(object, key, file, callback) {
    reload.watch(file, function(prev, curr) {
      object[key] = curr
      if (callback) {
        callback(prev, curr)
      }
    })
  }

  reload.event = function(file) {
    if (file) {
      return `reload:` + resolve(parentDir, file)
    } else {
      return `reload`
    }
  }

  // Expost EventEmitter API
  ;[
    `addListener`,
    `emit`,
    `on`,
    `once`,
    `removeAllListeners`,
    `removeListener`,
    `setMaxListeners`,
    `listeners`
  ].forEach(function(method) {
    reload[method] = ee[method].bind(ee)
  })

  return reload
}

function resolve(parentDir, relativeToParent) {
  let isNpm = true
  if (relativeToParent[0] === `.`) {
    isNpm = false // relative file
  }

  // Refresh require's cache
  let modPath
  if (isNpm) {
    modPath = relativeToParent
  } else {
    let relativeToMe = path.resolve(parentDir, relativeToParent) // get the path from parent's point of view
    modPath = require.resolve(relativeToMe)
  }

  return modPath
}
