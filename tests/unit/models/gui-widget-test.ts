import { guiStore, installRuntime } from '../../helpers/gui-types'
import type { AGateRuntime } from '../../../app/types/runtime'
import { module, test } from 'qunit'
import { setupTest } from 'ember-qunit'

module('Unit | Model | gui-widget', function(hooks) {
  setupTest(hooks)

  test('GUI records retain values and synchronous child relationships', function(assert) {
    const store = guiStore(this.owner)
    const parent = store.createRecord('gui-widget', { id: 'window', type: 'window' })
    const child = store.createRecord('gui-widget', { id: 'window.label', type: 'text', value: 'Inventory', parent })
    assert.strictEqual(child.componentName, 'gui-text')
    assert.strictEqual(child.value, 'Inventory')
    assert.strictEqual(Array.from(parent.components)[0], child)
    assert.strictEqual(child.parent, parent)
  })
})
