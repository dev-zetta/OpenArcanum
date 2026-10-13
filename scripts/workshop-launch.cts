#!/usr/bin/env node
'use strict'

// Select only the trusted bundled workshop; no retail path or downloaded code
// is required. The regular launcher owns Electron signals and smoke reporting.
process.env.OPENARCANUM_MODULE = 'inventory-workshop'
require('./electron-launch.cts')
