import { module, test } from 'qunit'
import { setupTest } from 'ember-qunit'

module('Unit | Adapter | local GUI definitions', function(hooks) {
  setupTest(hooks)
  let previousRuntime

  hooks.beforeEach(function() {
    previousRuntime = globalThis.AGate
    globalThis.AGate = { Utils: { loadScripts(_path, callback) {
      callback('inventory', { type: 'window', components: { title: { type: 'text', value: 'Inventory' } } })
      callback('toolbar', { type: 'group', parent: 'inventory' })
    } } }
  })
  hooks.afterEach(function() { globalThis.AGate = previousRuntime })

  test('loads local scripts into filtered records and resolves parent links', async function(assert) {
    const adapter = this.owner.lookup('adapter:application')
    const result = await adapter.query(null, null, { filter: { type: 'window' } })
    assert.strictEqual(result.data.length, 1)
    assert.strictEqual(result.data[0].id, 'inventory')
    assert.deepEqual(result.data[0].relationships.components.data.map(child => child.id), ['title', 'toolbar'])
    const title = result.included.find(record => record.id === 'title')
    assert.strictEqual(title.attributes.value, 'Inventory')
    assert.strictEqual(title.relationships.parent.data.id, 'inventory')
  })

  test('the configured store queries local definitions and materializes GUI relationships', async function(assert) {
    const store = this.owner.lookup('service:store')
    const windows = await store.query('gui-widget', { filter: { type: 'window' } })
    assert.strictEqual(windows.length, 1)
    const window = Array.from(windows)[0]
    assert.strictEqual(window.componentName, 'gui-window')
    assert.deepEqual(Array.from(window.components, child => child.id), ['title', 'toolbar'])
    assert.strictEqual(store.peekRecord('gui-widget', 'title').parent, window)
  })

  test('reports an unknown GUI identifier instead of returning a missing record', async function(assert) {
    const adapter = this.owner.lookup('adapter:application')
    await assert.rejects(adapter.findRecord(null, null, 'missing'), /Unknown GUI widget: missing/)
  })
})
