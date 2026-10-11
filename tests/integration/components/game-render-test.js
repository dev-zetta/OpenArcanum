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
  hooks.afterEach(function() {
    globalThis.requireNode = previousRequireNode
    globalThis.AGate = previousRuntime
    document.querySelector('link[data-arcanum-gui-assets]')?.remove()
  })

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

  test('an actual start failure reports its error and stops the partially created client', async function(assert) {
    globalThis.requireNode = name => name === 'node:path'
      ? { join: (...parts) => parts.join('/') }
      : {
        existsSync: () => true,
        statSync: () => ({ isDirectory: () => true }),
        readdirSync: () => ['Bates Mansion Lev 2.zip', 'Prototypes.zip', 'Gfx.zip', 'Gfx-tiles.zip']
      }
    const stylesheet = document.createElement('link')
    stylesheet.href = new URL('/gui-fixture.css', location.href).href
    stylesheet.dataset.arcanumGuiAssets = 'true'
    stylesheet.ready = Promise.resolve(stylesheet)
    document.head.append(stylesheet)
    const failure = new Error('Converted map fixture failed')
    let stops = 0
    const engine = {
      client: { stop() { stops++ } },
      async createClient(_canvas, options) {
        assert.true(options.standaloneMode, 'manual startup selects the offline scene')
        assert.strictEqual(options.mapId, 'Bates Mansion Lev 2')
        throw failure
      }
    }
    globalThis.AGate = {
      Utils: { loadScripts() {} },
      getAppUrl: () => stylesheet.href,
      createEngine: () => engine
    }
    const originalError = console.error
    const logged = []
    console.error = (...args) => logged.push(args)
    try {
      await render(hbs`<GameRender />`)
      assert.dom('[data-action="start-game"]').exists()
      await click('[data-action="start-game"]')
      assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
      assert.dom('[role="alert"]').includesText(failure.message)
      assert.dom('[data-action="start-game"]').isNotDisabled('startup can be retried')
      assert.strictEqual(stops, 1, 'partial client is stopped when startup rejects')
      assert.deepEqual(logged, [['Game startup failed', failure]], 'the original Error is logged with its stack')
    } finally {
      console.error = originalError
    }
  })
})
