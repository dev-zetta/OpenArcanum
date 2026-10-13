import type { RenderingTestContext } from '@ember/test-helpers'
import { guiStore, installRuntime } from '../../helpers/gui-types'
import type { AGateRuntime } from '../../../app/types/runtime'
import { module, test } from 'qunit'
import { setupRenderingTest } from 'ember-qunit'
import { render, click } from '@ember/test-helpers'
import { hbs } from 'ember-cli-htmlbars'

module('Integration | authored GUI controls', function(hooks) {
  setupRenderingTest(hooks)
  let previousRuntime: AGateRuntime | undefined
  let events: string[]

  hooks.beforeEach(function() {
    previousRuntime = globalThis.AGate
    events = []
    const module = globalThis.requireNode!('@openarcanum/agate')
    const Runtime = 'default' in module ? module.default : module
    installRuntime({
      Utils: Object.create(new Runtime({}).Utils),
      engine: { client: {
        guiManager: { addWidget() {} },
        listenUI() {},
        emitUI: (name: string) => events.push(name)
      } }
    })
  })
  hooks.afterEach(function() { globalThis.AGate = previousRuntime })

  test('dynamic authored children render and native controls update the existing GUI records', async function(this: RenderingTestContext, assert) {
    const store = guiStore(this.owner)
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

  test('authored arrow hooks create live children with widget context and preserved runtime closures', async function(this: RenderingTestContext, assert) {
    const listeners = new Map<string, (...args: unknown[]) => unknown>()
    globalThis.AGate!.engine!.client!.listenUI = (name, listener) => { listeners.set(name, listener) }
    globalThis.AGate!.Utils.loadScripts = (_path, callback) => callback('authored', {
      type: 'group',
      methods: { show(_widget, value) { this.setValue(value) } },
      events: {
        created: () => {
          const parent = this as unknown as import('../../../app/pods/components/gui-widget/component').default
          parent.createChildren({
            open: {
              type: 'button', options: { label: 'Open authored inventory' },
              events: { click() { parent.set('widget.value', 'opened') } }
            }
          })
        }
      }
    })
    const store = guiStore(this.owner)
    const groups = await store.query('gui-widget', { filter: { type: 'group' } })
    const root = Array.from(groups)[0]
    this.set('root', root)

    await render(hbs`<GuiGroup @widget={{this.root}} />`)
    assert.dom('button').hasText('Open authored inventory', 'created hook renders its generated child')
    assert.strictEqual(root.components.length, 1, 'the inverse relationship inserts the child exactly once')
    assert.strictEqual(store.peekRecord('gui-widget', 'authored.open')!.parent, root)
    await click('button')
    assert.strictEqual(root.value, 'opened', 'a generated callback retains its captured parent')
    const value = { source: 'authored-show-event' }
    listeners.get('authored:show')!(value)
    assert.strictEqual(root.value, value, 'method listeners forward payloads to authored replacements')
  })

  test('slot-only inventories initialize the current drag adapter and register generated dropzones', async function(this: RenderingTestContext, assert) {
    const store = guiStore(this.owner)
    const inventory = store.createRecord('gui-widget', {
      id: 'slots', type: 'inventory', options: { type: 'slots', slotSize: 31 },
      events: {
        created() { (this as import('../../../app/pods/components/gui-inventory/component').default).addSlots({ first: { position: [0, 0], size: [1, 1] } }) }
      }
    })
    this.set('inventory', inventory)
    await render(hbs`<GuiInventory @widget={{this.inventory}} />`)

    assert.dom('.gui-inventory-slot').exists({ count: 1 })
    const grid = (this.owner.lookup('service:droppable') as import('../../../app/pods/droppable/service').default).instances.inventory
    assert.strictEqual(grid.dropZones.length, 1)
    assert.strictEqual(grid.dropZones[0], this.element.querySelector('.gui-inventory-slot'), 'generated slot is a real registered dropzone')
    assert.strictEqual(inventory.components.length, 1)
    grid.destroy()
  })
})
