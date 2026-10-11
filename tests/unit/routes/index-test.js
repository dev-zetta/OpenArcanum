import { module, test } from 'qunit'
import { setupTest } from 'ember-qunit'

module('Unit | Route | index', function(hooks) {
  setupTest(hooks)

  test('entry route redirects through the current router service', function(assert) {
    const route = this.owner.lookup('route:index')
    let destination
    route.router.replaceWith = name => { destination = name }
    route.beforeModel()
    assert.strictEqual(destination, 'ingame')
  })
})
