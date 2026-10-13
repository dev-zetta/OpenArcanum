import type IndexRoute from '../../../app/routes/index'
import { module, test } from 'qunit'
import { setupTest } from 'ember-qunit'

module('Unit | Route | index', function(hooks) {
  setupTest(hooks)

  test('entry route redirects through the current router service', function(assert) {
    const route = this.owner.lookup('route:index') as IndexRoute
    let destination: string | undefined
    Object.assign(route.router, { replaceWith(name: string) { destination = name } })
    route.beforeModel()
    assert.strictEqual(destination, 'ingame')
  })
})
