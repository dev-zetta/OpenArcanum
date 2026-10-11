// Compatibility entry for old callers. Build the Flow sources before loading.
const bundle = require('../dist/index.cjs')
module.exports = bundle.default || bundle
