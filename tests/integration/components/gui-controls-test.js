import { module, test } from 'qunit'
import { setupRenderingTest } from 'ember-qunit'
import { render, click } from '@ember/test-helpers'
import { hbs } from 'ember-cli-htmlbars'

module('Integration | authored GUI controls', function(hooks) {
  setupRenderingTest(hooks)
  let previousRuntime
  let events

  hooks.beforeEach(function() {
    previousRuntime = globalThis.AGate
    events = []
    globalThis.AGate = {
      Utils: {
        isArray: Array.isArray,
        isString: value => typeof value === 'string',
        isNumber: value => typeof value === 'number',
        isFunction: value => typeof value === 'function',
        isUndefined: value => value === undefined
      },
      engine: { client: {
        guiManager: { addWidget() {} },
        listenUI() {},
        emitUI: name => events.push(name)
      } }
    }
  })
  hooks.afterEach(function() { globalThis.AGate = previousRuntime })

  test('dynamic authored children render and native controls update the existing GUI records', async function(assert) {
    const store = this.owner.lookup('service:store')
    const root = store.createRecord('gui-widget', { id: 'controls', type: 'group' })
    store.createRecord('gui-widget', {
      id: 'controls.open', type: 'button', parent: root,
      options: { label: 'Open inventory' }
    })
    const checkbox = store.createRecord('gui-widget', {
      id: 'controls.sound', type: 'checkbox', parent: root,
      options: { label: 'Sound enabled' }, value: false
    })
    this.set('root', root)

    await render(hbs`<GuiGroup @widget={{this.root}} />`)
    assert.dom('button').hasText('Open inventory')
    assert.dom('input[type="checkbox"]').hasAttribute('aria-label', 'Sound enabled')
    await click('button')
    assert.strictEqual(events.filter(name => name === 'controls.open:click').length, 1, 'one click emits one authored GUI event')
    await click('input[type="checkbox"]')
    assert.true(checkbox.value, 'native checkbox updates the GUI model')
  })
})
