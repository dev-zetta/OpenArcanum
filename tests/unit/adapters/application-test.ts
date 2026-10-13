import type ApplicationAdapter from '../../../app/adapters/application'
import { guiStore, installRuntime } from '../../helpers/gui-types'
import type { AGateRuntime } from '../../../app/types/runtime'
import { module, test } from 'qunit'
import { setupTest } from 'ember-qunit'

module('Unit | Adapter | local GUI definitions', function(hooks) {
  setupTest(hooks)
  let previousRuntime: AGateRuntime | undefined

  hooks.beforeEach(function() {
    previousRuntime = globalThis.AGate
    installRuntime({ Utils: { loadScripts(_path, callback) {
      callback('inventory', { type: 'window', components: { title: { type: 'text', value: 'Inventory' } } })
      callback('toolbar', { type: 'group', parent: 'inventory' })
    } } })
  })
  hooks.afterEach(function() { globalThis.AGate = previousRuntime })

  test('loads local scripts into filtered records and resolves parent links', async function(assert) {
    const adapter = this.owner.lookup('adapter:application') as ApplicationAdapter
    const result = await adapter.query(null, null, { filter: { type: 'window' } })
    assert.strictEqual(result.data.length, 1)
    assert.strictEqual(result.data[0].id, 'inventory')
    assert.deepEqual(result.data[0].relationships.components.data.map(child => child.id), ['inventory.title', 'inventory.toolbar'])
    const title = result.included.find(record => record.id === 'inventory.title')!
    assert.strictEqual(title.attributes.value, 'Inventory')
    assert.strictEqual(title.relationships.parent.data!.id, 'inventory')
  })

  test('the configured store queries local definitions and materializes GUI relationships', async function(assert) {
    const store = guiStore(this.owner)
    const windows = await store.query('gui-widget', { filter: { type: 'window' } })
    assert.strictEqual(windows.length, 1)
    const window = Array.from(windows)[0]
    assert.strictEqual(window.componentName, 'gui-window')
    assert.deepEqual(Array.from(window.components, child => child.id), ['inventory.title', 'inventory.toolbar'])
    assert.strictEqual(store.peekRecord('gui-widget', 'inventory.title')!.parent, window)
  })

  test('repeated local child names retain independent records and authored names', async function(assert) {
    globalThis.AGate!.Utils.loadScripts = (_path, callback) => {
      callback('skills', { type: 'group', components: { icon: { type: 'image', sprite: 'SkillsIcon' } } })
      callback('spells', { type: 'group', components: { icon: { type: 'image', sprite: 'SpellsIcon' } } })
    }
    const adapter = this.owner.lookup('adapter:application') as ApplicationAdapter
    const records = adapter.loadRecords()
    assert.strictEqual(records.get('skills.icon')!.attributes.sprite, 'SkillsIcon')
    assert.strictEqual(records.get('spells.icon')!.attributes.sprite, 'SpellsIcon')
    assert.strictEqual(records.get('skills.icon')!.attributes.name, 'icon')
    assert.strictEqual(records.get('spells.icon')!.relationships.parent.data!.id, 'spells')
  })

  test('reports an unknown GUI identifier instead of returning a missing record', async function(assert) {
    const adapter = this.owner.lookup('adapter:application') as ApplicationAdapter
    await assert.rejects(adapter.findRecord(null, null, 'missing'), /Unknown GUI widget: missing/)
  })
})
