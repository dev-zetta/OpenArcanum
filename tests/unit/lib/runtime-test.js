import { module, test } from 'qunit'
import { getDataStatus } from 'open-arcanum/lib/runtime'

module('Unit | local data readiness', function() {
  test('authored scripts may live separately from converted game assets', function(assert) {
    const files = new Set([
      '/project/scripts/client/gui',
      '/converted/gui/gui-images.css',
      '/converted/gui/gui-images.json',
      '/converted/archives'
    ])
    const requireNode = name => name === 'node:path'
      ? { join: (...parts) => parts.join('/') }
      : {
        existsSync: path => files.has(path),
        statSync: () => ({ isDirectory: () => true }),
        readdirSync: () => ['arcanum.zip']
      }
    const status = getDataStatus({ dataPath: '/converted', scriptsPath: '/project/scripts' }, requireNode)
    assert.true(status.ready)
    assert.true(status.message.includes('have not been validated'), 'file presence does not claim campaign compatibility')

    files.delete('/converted/gui/gui-images.json')
    const missing = getDataStatus({ dataPath: '/converted', scriptsPath: '/project/scripts' }, requireNode)
    assert.false(missing.ready)
    assert.true(missing.message.includes('gui/gui-images.json'))
    assert.false(missing.message.includes('client/gui'), 'existing authored scripts are not reported missing')
  })
})
