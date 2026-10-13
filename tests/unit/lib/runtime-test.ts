import { fixtureRequire } from '../../helpers/gui-types'
import { module, test } from 'qunit'
import { getDataStatus } from 'open-arcanum/lib/runtime'

module('Unit | local data readiness', function() {
  function workshopFixture() {
    const mapId = 'Inventory workshop'
    const files = ['16086.json', `${mapId}/Map.json`, `${mapId}/Sector/0/0/Sector.json`,
      'Prototypes/Pc/900001.json', 'Prototypes/Container/900002.json', 'Prototypes/Generic/900003.json',
      'Prototypes/Portal/900004.json', `${mapId}/Sector/0/0/Container/owned-workshop-box.json`,
      `${mapId}/Sector/0/0/Generic/owned-workshop-token.json`, `${mapId}/Sector/0/0/Portal/owned-workshop-door.json`,
      'Gfx/2D/Tile/tiles.json', 'Gfx/2D/Tile/tiles.png',
      'archives/Prototypes.zip', `archives/${mapId}.zip`, 'archives/Gfx.zip']
    for (const base of ['Gfx/2D/Container/Workshop/Box', 'Gfx/2D/Portal/Door/Workshop/0']) {
      files.push(`${base}/Meta.json`, `${base}/0/North/Stage.json`, `${base}/0/North/Sprite.png`)
    }
    for (const animation of ['Stand', 'Walk']) {
      const base = `Gfx/2D/Critter/Workshop/Male/Coat/None/Unarmed/${animation}`
      files.push(`${base}/Meta.json`, `${base}/0/South/Stage.json`, `${base}/0/South/Sprite.png`)
    }
    const manifest = { format: 'openarcanum-owned-module', version: 1, id: 'inventory-workshop', mapId, data: 'data', files }
    const configuration = { moduleId: 'inventory-workshop', developmentMap: mapId,
      dataPath: '/bundled/data', moduleManifestPath: '/bundled/module.json', scriptsPath: '/missing/retail-scripts' }
    const available = new Set(['/bundled/module.json', ...files.map(name => `/bundled/data/${name}`)])
    const checked: string[] = []
    const requireNode = fixtureRequire((name: string) => name === 'node:path' ? { join: (...parts: string[]) => parts.join('/') } : {
      existsSync(file: string) { checked.push(file); return available.has(file) },
      readFileSync: () => JSON.stringify(manifest),
      readdirSync() { throw new Error('The workshop does not enumerate retail archives') }
    })
    return { manifest, configuration, available, checked, requireNode }
  }

  test('authored scripts may live separately from converted game assets', function(assert) {
    const files = new Set([
      '/project/scripts/client/gui',
      '/converted/gui/gui-images.css',
      '/converted/gui/gui-images.json',
      '/converted/archives',
      '/converted/16086.json'
    ])
    const requireNode = fixtureRequire((name: string) => name === 'node:path'
      ? { join: (...parts: string[]) => parts.join('/') }
      : {
        existsSync: (path: string) => files.has(path),
        statSync: () => ({ isDirectory: () => true }),
        readdirSync: () => ['Bates Mansion Lev 2.zip', 'Prototypes.zip', 'Gfx.zip', 'Gfx-tiles.zip']
      })
    const status = getDataStatus({ dataPath: '/converted', scriptsPath: '/project/scripts' }, requireNode)
    assert.true(status.ready)
    assert.true(status.message.includes('have not been validated'), 'file presence does not claim campaign compatibility')

    files.delete('/converted/gui/gui-images.json')
    const missing = getDataStatus({ dataPath: '/converted', scriptsPath: '/project/scripts' }, requireNode)
    assert.false(missing.ready)
    assert.true(missing.message.includes('gui/gui-images.json'))
    assert.false(missing.message.includes('client/gui'), 'existing authored scripts are not reported missing')
  })

  test('bundled workshop readiness uses owned manifest assets without retail GUI or game data', function(assert) {
    const fixture = workshopFixture()
    const status = getDataStatus(fixture.configuration, fixture.requireNode)
    assert.true(status.ready)
    assert.true(status.ownedModule)
    assert.strictEqual(status.mapId, 'Inventory workshop')
    assert.true(status.message.includes('No original game data is required'))
    assert.false(fixture.checked.some(name => name.includes('gui-images') || name.includes('client/gui') || name.includes('Bates')))
    fixture.available.delete('/bundled/data/Prototypes/Generic/900003.json')
    fixture.available.delete('/bundled/data/Gfx/2D/Tile/tiles.png')
    const missing = getDataStatus(fixture.configuration, fixture.requireNode)
    assert.false(missing.ready)
    assert.true(missing.message.includes('Prototypes/Generic/900003.json'))
    assert.true(missing.message.includes('tiles.png'))
    assert.false(missing.message.includes('Gfx-tiles.zip'), 'the owned graphics archive also contains its tiles')
  })

  test('owned manifests cannot hide essential assets or redirect readiness checks outside their data', function(assert) {
    for (const modify of [
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.id = 'another-module' },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.mapId = 'Another map' },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.version = 2 },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.data = '../other' },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files.push('../escape.json') },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files.push('/absolute.json') },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files.push('C:/absolute.json') },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files.push('scripts/start.js') },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files.push(manifest.files[0]) },
      (manifest: ReturnType<typeof workshopFixture>['manifest']) => { manifest.files = manifest.files.filter(name => name !== '16086.json') }
    ]) {
      const fixture = workshopFixture()
      modify(fixture.manifest)
      const status = getDataStatus(fixture.configuration, fixture.requireNode)
      assert.false(status.ready)
      assert.true(status.message.includes('manifest is missing or invalid'))
      assert.deepEqual(fixture.checked, ['/bundled/module.json'], 'invalid manifests never probe their asset list')
    }
    const fixture = workshopFixture()
    fixture.available.delete('/bundled/module.json')
    assert.false(getDataStatus(fixture.configuration, fixture.requireNode).ready)
  })

  test('unknown modules fail before file access and the owned workshop still requires desktop access', function(assert) {
    const unknown = getDataStatus({ moduleId: '../custom-module' }, fixtureRequire(() => assert.step('unexpected file access')))
    assert.false(unknown.ready)
    assert.true(unknown.message.includes('Unknown bundled module'))
    assert.verifySteps([])
    const desktop = getDataStatus({ moduleId: 'inventory-workshop' }, null)
    assert.false(desktop.ready)
    assert.true(desktop.ownedModule)
    assert.true(desktop.message.includes('desktop runtime'))
    assert.false(desktop.message.includes('local game data'))
  })
})
