'use strict'
// Retained as an explicit smoke entry point; the obsolete Ember Electron Testem
// protocol runner has been replaced by the real application's readiness check.
if (!process.argv.includes('--smoke')) process.argv.push('--smoke')
require('./main.js')
