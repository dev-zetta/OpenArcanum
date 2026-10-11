import { module, test } from 'qunit'
import { setupRenderingTest } from 'ember-qunit'
import { render, click } from '@ember/test-helpers'
import { hbs } from 'ember-cli-htmlbars'

module('Integration | Component | game-render', function(hooks) {
  setupRenderingTest(hooks)
  let previousRequireNode
  let previousRuntime

  hooks.beforeEach(function() {
    previousRequireNode = globalThis.requireNode
    previousRuntime = globalThis.AGate
    globalThis.requireNode = name => {
      if (name === 'node:fs') return { existsSync: () => false }
      if (name === 'node:path') return { join: (...parts) => parts.join('/') }
      throw new Error(`The stopped runtime must not load ${name}`)
    }
  })
  hooks.afterEach(function() { globalThis.requireNode = previousRequireNode })

  test('missing local data leaves the real runtime stopped and explains prerequisites', async function(assert) {
    await render(hbs`<GameRender />`)
    assert.dom('[data-runtime-status="ready"]').exists()
    assert.dom('[data-assets-state]').hasAttribute('data-assets-state', 'missing')
    assert.dom('h1').hasText('OpenArcanum')
    assert.dom('canvas').isNotVisible()
    assert.dom('.app-status').includesText('converted Arcanum data')
    assert.dom('button').hasText('Check data again')
    await click('button')
    assert.dom('.app-status').exists('checking data keeps the existing application responsive')
    assert.strictEqual(globalThis.AGate, previousRuntime, 'missing assets do not instantiate the game engine')
  })
})
