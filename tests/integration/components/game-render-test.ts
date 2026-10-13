import type { RenderingTestContext } from '@ember/test-helpers'
import { guiStore, installRuntime, fixtureRequire } from '../../helpers/gui-types'
import type { AGateRuntime, DesktopRequire, DesktopBridge } from '../../../app/types/runtime'
import type { FixtureClient, FixtureItem, FixtureCharacter, FixtureAttribute, TargetAction, ItemAction, ClientAction, ArgsAction } from '../../helpers/game-client'
import type GuiWidget from '../../../app/pods/components/gui-widget/component'
import type { GuiSprite } from '../../../app/types/widgets'
import { module, test } from 'qunit'
import { setupRenderingTest } from 'ember-qunit'
import { render, click, clearRender, waitUntil, triggerEvent, settled } from '@ember/test-helpers'
import { hbs } from 'ember-cli-htmlbars'

module('Integration | Component | game-render', function(hooks) {
  setupRenderingTest(hooks)
  let previousRequireNode: DesktopRequire | undefined
  let previousRuntime: AGateRuntime | undefined
  let previousDesktop: DesktopBridge | undefined
  let serverStarts: number
  let serverStops: number
  let startedIds: string[]
  let stoppedIds: string[]
  const authoritySession: import('../../../app/types/runtime').LocalAuthoritySession = { url: 'http://127.0.0.1:1234', token: 'fixture', observerToken: 'fixture-observer', protocolVersion: 1, pid: 123, mapId: 'Bates Mansion Lev 2' }

  hooks.beforeEach(function() {
    previousRequireNode = globalThis.requireNode
    previousRuntime = globalThis.AGate
    previousDesktop = globalThis.openArcanumDesktop
    serverStarts = serverStops = 0
    startedIds = []
    stoppedIds = []
    globalThis.openArcanumDesktop = {
      config: { ...previousDesktop!.config, moduleId: undefined, moduleManifestPath: undefined,
        authoredGui: undefined, developmentMap: 'Bates Mansion Lev 2' },
      async startLocalServer(id) { serverStarts++; startedIds.push(id); return authoritySession },
      async stopLocalServer(id) { serverStops++; stoppedIds.push(id); return { state: 'stopped', pid: null, mapId: authoritySession.mapId } }
    }
    globalThis.requireNode = fixtureRequire(name => {
      if (name === 'node:fs') return { existsSync: () => false }
      if (name === 'node:path') return { join: (...parts: string[]) => parts.join('/') }
      throw new Error(`The stopped runtime must not load ${name}`)
    })
  })
  hooks.afterEach(function() {
    globalThis.requireNode = previousRequireNode
    globalThis.AGate = previousRuntime
    globalThis.openArcanumDesktop = previousDesktop
    document.querySelector('link[data-arcanum-gui-assets]')?.remove()
  })

  test('missing local data leaves the real runtime stopped and explains prerequisites', async function(this: RenderingTestContext, assert) {
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
    assert.strictEqual(serverStarts, 0, 'missing assets do not start the server')
  })

  function provideData() {
    globalThis.requireNode = fixtureRequire(name => name === 'node:path'
      ? { join: (...parts: string[]) => parts.join('/') }
      : {
        existsSync: () => true,
        statSync: () => ({ isDirectory: () => true }),
        readdirSync: () => ['Bates Mansion Lev 2.zip', 'Prototypes.zip', 'Gfx.zip', 'Gfx-tiles.zip']
      })
    const stylesheet: HTMLLinkElement & { ready?: Promise<HTMLLinkElement> } = document.createElement('link')
    stylesheet.href = new URL('/gui-fixture.css', location.href).href
    stylesheet.dataset.arcanumGuiAssets = 'true'
    stylesheet.ready = Promise.resolve(stylesheet)
    document.head.append(stylesheet)
    return stylesheet
  }

  test('an actual start failure reports its error and stops the partially created client', async function(this: RenderingTestContext, assert) {
    const stylesheet = provideData()
    const failure = new Error('Converted map fixture failed')
    let stops = 0
    const engine = {
      client: { stop() { stops++ } },
      async createClient(_canvas: HTMLCanvasElement, options: Parameters<import('../../../app/types/runtime').GameEngine['createClient']>[1]) {
        assert.true(options.standaloneMode, 'the renderer leaves legacy simulation systems disabled')
        assert.strictEqual(options.mapId, 'Bates Mansion Lev 2')
        assert.strictEqual(options.authoritySession, authoritySession, 'the replica receives the owned local session')
        assert.false(options.signal.aborted, 'startup can be cancelled when the component is destroyed')
        throw failure
      }
    }
    installRuntime({
      Utils: { loadScripts() {} },
      getAppUrl: () => stylesheet.href,
      createEngine: () => engine
    })
    const originalError = console.error
    const logged: unknown[][] = []
    console.error = (...args) => logged.push(args)
    try {
      await render(hbs`<GameRender />`)
      assert.dom('[data-action="start-game"]').exists()
      await click('[data-action="start-game"]')
      assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
      assert.dom('[role="alert"]').includesText(failure.message)
      assert.dom('[data-action="start-game"]').isNotDisabled('startup can be retried')
      assert.strictEqual(stops, 1, 'partial client is stopped when startup rejects')
      assert.strictEqual(serverStarts, 1, 'the authority starts before the client')
      assert.strictEqual(serverStops, 1, 'failed client startup reaps its server')
      assert.deepEqual(stoppedIds, startedIds, 'cleanup addresses only the component-owned session')
      assert.deepEqual(logged, [['Game startup failed', failure]], 'the original Error is logged with its stack')
    } finally {
      console.error = originalError
    }
  })

  test('destroying during server startup cancels the owned session and never creates a client', async function(this: RenderingTestContext, assert) {
    const stylesheet = provideData()
    let resolveStart!: (value: typeof authoritySession) => void
    Object.assign(globalThis.openArcanumDesktop!, { startLocalServer: (id: string) => {
      serverStarts++
      startedIds.push(id)
      return new Promise<typeof authoritySession>(resolve => { resolveStart = resolve })
    } })
    installRuntime({
      Utils: { loadScripts() {} },
      getAppUrl: () => stylesheet.href,
      createEngine() { assert.step('created abandoned client') }
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await waitUntil(() => resolveStart)
    await clearRender()
    assert.strictEqual(serverStops, 1, 'teardown cancels a pending host start')
    resolveStart(authoritySession)
    await waitUntil(() => serverStops === 2)
    assert.strictEqual(serverStarts, 1)
    assert.true(typeof startedIds[0] === 'string' && startedIds[0].length > 0)
    assert.deepEqual(stoppedIds, [startedIds[0], startedIds[0]], 'late startup cleanup keeps the old session owner')
    assert.verifySteps([], 'no engine was created after component destruction')
  })

  function provideInteractionClient(use: TargetAction) {
    const stylesheet = provideData()
    const listeners = new Map<string, Set<(value: unknown) => void>>()
    const events = {
      on(name: string, callback: (value: unknown) => void) {
        if (!listeners.has(name)) listeners.set(name, new Set())
        listeners.get(name)!.add(callback)
      },
      off(name: string, callback: (value: unknown) => void) { listeners.get(name)?.delete(callback) },
      emit(name: string, value: unknown) { for (const callback of listeners.get(name) || []) callback(value) }
    }
    const client: FixtureClient = {
      events,
      authorityState: { doors: [
        { id: 'synthetic/door-a.json', label: 'Door', open: false, locked: false, usable: true },
        { id: 'synthetic/door-b.json', label: 'Door', open: false, locked: true, usable: false, reason: 'This door is locked.' }
      ] },
      guiManager: { setRootWidget() {}, setMouseSprite() {} },
      emitUI() {},
      stop() {},
      useTarget(targetId) { return use(client, targetId) }
    }
    installRuntime({
      Utils: { loadScripts() {} },
      getAppUrl: () => stylesheet.href,
      createEngine: () => ({ client, async createClient() { return client } })
    })
    return { client, listeners }
  }

  test('authored root windows register with the manager under the GameRender host and own their children', async function(this: RenderingTestContext, assert) {
    const fixture = provideInteractionClient(async () => {})
    const runtime = globalThis.AGate!
    const roots: GuiWidget[] = []
    let host: unknown
    const image = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="brown"/></svg>')
    const artwork: GuiSprite = {
      attachToElement(element) { element.css('background-image', `url("${image}")`) },
      detachFromElement(element) { element.css('background-image', 'none') },
      getFrame: () => ({ left: 0, top: 0, width: 16, height: 12 }),
      getLastFrame: () => ({ left: 0, top: 0, width: 16, height: 12 }),
      getFrameCount: () => 1, hasFrame: index => index === 0
    }
    const client = {
      ...fixture.client,
      guiManager: {
        ...fixture.client.guiManager,
        setRootWidget(value: unknown) { host = value },
        addWidget(widget: GuiWidget) { roots.push(widget) },
        getSprite(key: string) { return key === 'authored-background' ? artwork : undefined }
      },
      listenUI() {}, listenOnceUI() {}
    }
    installRuntime({
      Utils: { loadScripts(_path, callback) {
        callback('authored-host', {
          type: 'window', sprite: 'authored-background', visible: true, size: [16, 12],
          components: { label: { type: 'text', value: 'Authored child' } }
        })
      } },
      engine: { client }, getAppUrl: runtime.getAppUrl,
      createEngine: () => ({ client, async createClient() { return client } })
    })

    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    assert.dom('#gui .gui-window').exists({ count: 1 })
    assert.dom('#gui .gui-text').hasText('Authored child')
    assert.strictEqual(roots.length, 1, 'only the top-level authored window belongs to the manager')
    const root = roots[0]
    assert.strictEqual(root.parentWidget, host, 'the real GameRender component is the explicit host')
    assert.strictEqual(root.getParent(), undefined, 'a render host is not a GuiWidget parent')
    assert.strictEqual(root.getChildren().size, 1, 'the root owns the nested widget registry')
    const child = root.getChildren().get('label')!
    assert.strictEqual(child.getParent(), root)
    assert.strictEqual(child.widget.parent, root.widget, 'the authored store relationship is preserved')
    assert.true((root.getElement().css('background-image') || '').includes(image), 'authored artwork attaches after root registration')
    const updated = root.createChild({ id: 'authored-host.label', value: 'Updated authored child' })
    assert.strictEqual(updated, child.widget, 'updating a child reuses the authored store record')
    await settled()
    assert.dom('#gui .gui-text').hasText('Updated authored child', 'native model setters notify the rendered child')
    assert.strictEqual(root.widget.components.length, 1, 'reusing a child does not duplicate the relationship')
  })

  test('door controls send the selected target and display completed server state', async function(this: RenderingTestContext, assert) {
    const commands: unknown[] = []
    provideInteractionClient(async (client, targetId) => {
      commands.push(targetId)
      client.events.emit('Player:InteractionUpdated', { targetId, status: 'pending', message: 'Using door…' })
      client.authorityState.doors = client.authorityState.doors.map(door => door.id === targetId ? { ...door, open: true } : door)
      client.events.emit('World:InteractionsUpdated', client.authorityState.doors)
      client.events.emit('Player:InteractionUpdated', { targetId, status: 'completed', message: 'Door opened.', open: true })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-interaction-panel]').exists()
    assert.dom('[data-interaction-panel]').doesNotIncludeText('synthetic/')
    assert.dom('[data-interaction-panel] label').hasText('Choose a door')
    await click('[data-action="use-door"]')
    assert.deepEqual(commands, ['synthetic/door-a.json'], 'only the selected server target is submitted')
    assert.dom('[role="status"]').hasText('Door opened.')
    assert.dom('[data-interaction-status]').hasAttribute('data-interaction-status', 'completed')
    assert.dom('option:checked').hasText('Door 1 — open')
    assert.dom('[data-action="use-door"]').isNotDisabled()
  })

  test('locked door rejection remains escaped, visible and recoverable without stopping the map', async function(this: RenderingTestContext, assert) {
    const message = 'Door is locked. <img src=x onerror=alert(1)>'
    const commands: unknown[] = []
    provideInteractionClient(async (client, targetId) => {
      commands.push(targetId)
      client.events.emit('Player:InteractionUpdated', { targetId, status: 'rejected', message })
      throw new Error(message)
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    this.element.querySelector<HTMLSelectElement>('select')!.value = 'synthetic/door-b.json'
    await triggerEvent('select', 'change')
    await click('[data-action="use-door"]')
    assert.deepEqual(commands, ['synthetic/door-b.json'], 'lock decisions remain with the server')
    assert.dom('[role="status"]').hasText(message)
    assert.dom('[role="status"] img').doesNotExist('server messages are rendered as text')
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    assert.dom('[role="alert"]').doesNotExist()
    assert.dom('[data-action="use-door"]').isNotDisabled('the player can choose another interaction')
  })

  test('a reviewed locked door forwards only its target and keeps key authorization with the server', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const { client } = provideInteractionClient(async () => {})
    const key = { id: 'private-held-key', slot: 0, label: 'Key', type: 'Key', prototypeId: 900005 }
    client.inventoryState = { status: 'ready', known: true, ownerId: '16086.json', items: [key], message: 'Inventory ready.' }
    client.authorityState.doors[1] = { ...client.authorityState.doors[1], usable: true,
      reason: 'A held key is required. <img src=x onerror=alert(1)>' }
    client.useTarget = async (...args) => {
      calls.push(args)
      const [targetId] = args
      client.authorityState.doors = client.authorityState.doors.map(door => door.id === targetId ? { ...door, open: true } : door)
      client.events.emit('World:InteractionsUpdated', client.authorityState.doors)
      client.events.emit('Player:InteractionUpdated', { targetId, status: 'completed', message: 'Door opened.', open: true })
    }
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    this.element.querySelector<HTMLSelectElement>('#door-target')!.value = 'synthetic/door-b.json'
    await triggerEvent('#door-target', 'change')
    assert.dom('[data-action="use-door"]').isNotDisabled()
    assert.dom('[data-interaction-panel]').includesText('A held key is required. <img src=x onerror=alert(1)>')
    assert.dom('[data-interaction-panel] img').doesNotExist()
    await click('[data-action="use-door"]')
    assert.deepEqual(calls, [['synthetic/door-b.json']], 'no key identity or matching decision is sent by the view')
    assert.dom('#door-target option:checked').hasText('Door 2 — open (locked)')
    assert.dom('[data-interaction-status]').hasText('Door opened.')
    assert.dom('[data-inventory-items] li span').hasText('Key', 'the view does not consume a held key')
    assert.deepEqual(client.inventoryState!.items, [key])
    assert.dom('[data-interaction-panel]').doesNotIncludeText(key.id)
  })

  test('pending interaction disables controls and teardown removes subscriptions before late completion', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners } = provideInteractionClient((replica, targetId) => {
      replica.events.emit('Player:InteractionUpdated', { targetId, status: 'approaching', message: 'Approaching door…' })
      return new Promise<unknown>(resolve => { complete = resolve })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="use-door"]')
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('select').isDisabled()
    assert.dom('[role="status"]').hasText('Approaching door…')
    await clearRender()
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    assert.strictEqual(listeners.get('World:InteractionsUpdated')!.size, 0)
    client.events.emit('Player:InteractionUpdated', { status: 'completed', message: 'Door opened.' })
    complete()
    assert.dom('[data-interaction-panel]').doesNotExist()
  })

  test('runtime failure removes door subscriptions as the map stops', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = provideInteractionClient(async () => {})
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Server connection lost'))
    await waitUntil(() => !this.element.querySelector('[data-interaction-panel]'))
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    assert.strictEqual(listeners.get('World:InteractionsUpdated')!.size, 0)
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })

  function provideCheckpointClient(actions: { save?: ClientAction; load?: ClientAction } = {}) {
    const fixture = provideInteractionClient(async () => {})
    fixture.client.authorityState.checkpoint = { supported: true, busy: false }
    fixture.client.saveCheckpoint = () => actions.save?.(fixture.client)
    fixture.client.loadCheckpoint = () => actions.load?.(fixture.client)
    return fixture
  }

  test('checkpoint controls send explicit save and load intentions without startup or optimistic world changes', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const savedAt = '2026-10-12T12:00:00.000Z'
    const { client } = provideCheckpointClient({
      async save() { calls.push('save'); return { kind: 'save', savedAt } },
      async load() { calls.push('load'); return { kind: 'load', savedAt } }
    })
    const originalDoors = JSON.stringify(client.authorityState.doors)
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.deepEqual(calls, [], 'starting never auto-saves or auto-loads')
    assert.dom('[data-checkpoint-panel]').includesText('Loading restores this local development session.')
    assert.dom('[data-action="save-checkpoint"]').hasText('Save checkpoint')
    assert.dom('[data-action="load-checkpoint"]').hasText('Load checkpoint')
    await click('[data-action="save-checkpoint"]')
    assert.deepEqual(calls, ['save'])
    assert.dom('[data-checkpoint-status]').hasText('Checkpoint saved.')
    await click('[data-action="load-checkpoint"]')
    assert.deepEqual(calls, ['save', 'load'])
    assert.dom('[data-checkpoint-status]').hasText('Checkpoint loaded.')
    assert.strictEqual(JSON.stringify(client.authorityState.doors), originalDoors, 'controls never rewrite server door state')
    assert.dom('[data-checkpoint-panel]').doesNotIncludeText('synthetic/')
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
    assert.dom('[data-action="load-checkpoint"]').isNotDisabled()
  })

  test('checkpoint rejection is escaped and recoverable while the local map keeps running', async function(this: RenderingTestContext, assert) {
    const message = 'No saved checkpoint. <img src=x onerror=alert(1)>'
    provideCheckpointClient({ async load() { throw new Error(message) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="load-checkpoint"]')
    assert.dom('[data-checkpoint-status]').hasText(message)
    assert.dom('[data-checkpoint-status]').hasAttribute('data-checkpoint-status', 'rejected')
    assert.dom('[data-checkpoint-status] img').doesNotExist()
    assert.dom('[role="alert"]').doesNotExist()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
    assert.dom('[data-action="load-checkpoint"]').isNotDisabled()
  })

  test('pending checkpoint disables conflicting controls and teardown removes its listener before a late result', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client, listeners } = provideCheckpointClient({
      save() { calls.push('save'); return new Promise<unknown>(resolve => { complete = resolve }) },
      async load() { calls.push('load') }
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="save-checkpoint"]')
    assert.dom('[data-checkpoint-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-checkpoint-status]').hasText('Saving checkpoint…')
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('select').isDisabled()
    assert.deepEqual(calls, ['save'])
    await clearRender()
    assert.strictEqual(listeners.get('Player:CheckpointUpdated')!.size, 0)
    client.events.emit('Player:CheckpointUpdated', { action: 'save', status: 'completed', message: 'Checkpoint saved.' })
    complete({ kind: 'save', savedAt: '2026-10-12T12:00:00.000Z' })
    assert.dom('[data-checkpoint-panel]').doesNotExist()
  })

  test('runtime failure removes the checkpoint subscription as the map stops', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = provideCheckpointClient()
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Server connection lost'))
    await waitUntil(() => !this.element.querySelector('[data-checkpoint-panel]'))
    assert.strictEqual(listeners.get('Player:CheckpointUpdated')!.size, 0)
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })

  function provideContainerClient(use: TargetAction) {
    const fixture = provideInteractionClient(use)
    fixture.client.authorityState.containers = [
      { id: 'synthetic/container-a.json', kind: 'container', label: 'Container', locked: false, usable: true,
        items: [{ label: 'Never display a public row' }] },
      { id: 'synthetic/container-b.json', kind: 'container', label: 'Container', locked: true, usable: false,
        reason: 'This container is locked.' }
    ]
    fixture.client.authorityState.checkpoint = { supported: true, busy: false }
    return fixture
  }

  function provideWorkshop(assert: Assert) {
    const fixture = provideContainerClient(async (client, targetId) => {
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true,
        items: [{ id: 'owned-workshop-token', slot: 0, label: 'Item', type: 'Generic', prototypeId: 900003 }] })
    })
    document.querySelector('link[data-arcanum-gui-assets]')?.remove()
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
    const available = new Set(['/owned/module.json', ...files.map(name => `/owned/data/${name}`)])
    const configuration = { moduleId: 'inventory-workshop', developmentMap: mapId, authoredGui: false,
      dataPath: '/owned/data', moduleManifestPath: '/owned/module.json', scriptsPath: '/missing/retail-scripts' }
    Object.assign(globalThis.openArcanumDesktop!, { config: configuration })
    globalThis.requireNode = fixtureRequire(name => name === 'node:path' ? { join: (...parts: string[]) => parts.join('/') } : {
      existsSync: (file: string) => available.has(file),
      readFileSync: () => JSON.stringify(manifest)
    })
    fixture.client.guiManager.setMouseSprite = () => assert.step('legacy cursor requested')
    installRuntime({
      Utils: { loadScripts() { assert.step('legacy scripts requested') } },
      getAppUrl() { assert.step('legacy stylesheet requested'); throw new Error('No retail stylesheet is available') },
      createEngine: () => ({ client: fixture.client, async createClient(_canvas: HTMLCanvasElement, options: Parameters<import('../../../app/types/runtime').GameEngine['createClient']>[1]) {
        assert.strictEqual(options.mapId, mapId)
        assert.strictEqual(options.moduleId, 'inventory-workshop')
        assert.false(options.authoredGui)
        return fixture.client
      } })
    })
    return { ...fixture, available, manifest }
  }

  test('owned workshop starts and inspects without retail data, authored widgets, styles or scripts', async function(this: RenderingTestContext, assert) {
    provideWorkshop(assert)
    guiStore(this.owner).query = () => {
      assert.step('legacy widget query requested')
      throw new Error('No authored widgets are available')
    }
    await render(hbs`<GameRender />`)
    assert.dom('h1').hasText('Inventory workshop')
    assert.dom('.app-status').includesText('All artwork and data are included.')
    assert.dom('.app-status').doesNotIncludeText('DAT')
    assert.dom('.app-status').doesNotIncludeText('Local data directory')
    assert.dom('[data-action="start-game"]').hasText('Start inventory workshop')
    await click('[data-action="start-game"]')
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    assert.strictEqual(serverStarts, 1)
    assert.strictEqual(document.querySelector('link[data-arcanum-gui-assets]'), null)
    assert.dom('#gui .gui-widget').doesNotExist()
    assert.dom('[data-container-panel]').exists()
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-items] li').hasText('Item')
    assert.dom('[data-container-items] button').doesNotExist('taking requires verified actor inventory')
    assert.verifySteps([], 'no legacy GUI path ran')
  })

  test('missing owned artwork blocks workshop startup without asking for retail assets', async function(this: RenderingTestContext, assert) {
    const { available } = provideWorkshop(assert)
    available.delete('/owned/data/Gfx/2D/Tile/tiles.png')
    await render(hbs`<GameRender />`)
    assert.dom('h1').hasText('Inventory workshop')
    assert.dom('[data-action="start-game"]').doesNotExist()
    assert.dom('.app-status').includesText('tiles.png')
    assert.dom('.app-status').doesNotIncludeText('Provide your own converted Arcanum data')
    assert.strictEqual(serverStarts, 0)
    assert.verifySteps([])
  })

  test('unknown module configuration cannot start the local server or load authored scripts', async function(this: RenderingTestContext, assert) {
    Object.assign(globalThis.openArcanumDesktop!, { config: { moduleId: 'unknown-module' } })
    globalThis.requireNode = fixtureRequire(() => assert.step('unexpected runtime access'))
    await render(hbs`<GameRender />`)
    assert.dom('.app-status').includesText('Unknown bundled module: unknown-module.')
    assert.dom('[data-action="start-game"]').doesNotExist()
    assert.strictEqual(serverStarts, 0)
    assert.verifySteps([])
  })

  test('container controls show only completed owner contents, escaped labels and quantity', async function(this: RenderingTestContext, assert) {
    const commands: unknown[] = []
    const label = 'Weapon <img src=x onerror=alert(1)>'
    provideContainerClient(async (client, targetId) => {
      commands.push(targetId)
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true,
        items: [{ id: 'private-item-a', slot: 0, label, type: 'Weapon', prototypeId: 2001, quantity: 2 }] })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-container-panel]').exists()
    assert.dom('[data-container-panel] label').hasText('Choose a container')
    assert.dom('[data-container-panel]').doesNotIncludeText('Never display a public row')
    assert.dom('[data-container-items]').doesNotExist('contents are not inferred from public descriptors')
    await click('[data-action="inspect-container"]')
    assert.deepEqual(commands, ['synthetic/container-a.json'])
    assert.dom('[data-container-status]').hasAttribute('data-container-status', 'completed')
    assert.dom('[data-container-items] li').hasText(`${label} × 2`)
    assert.dom('[data-container-items] img').doesNotExist()
    assert.dom('[data-container-panel]').doesNotIncludeText('private-item-a')
    assert.dom('[data-container-panel]').doesNotIncludeText('2001')
    assert.dom('[data-container-panel]').doesNotIncludeText('synthetic/')
    assert.dom('[data-action="use-door"]').isNotDisabled('door controls remain usable after inspection')
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
  })

  test('changing container selection and a locked rejection clear prior private contents', async function(this: RenderingTestContext, assert) {
    const { client } = provideContainerClient(async (replica, targetId) => {
      if (targetId.endsWith('container-b.json')) throw new Error('Container is locked.')
      replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true,
        items: [{ label: 'Weapon', quantity: 1 }] })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-items] li').hasText('Weapon')
    this.element.querySelector<HTMLSelectElement>('#container-target')!.value = 'synthetic/container-b.json'
    await triggerEvent('#container-target', 'change')
    assert.dom('[data-container-items]').doesNotExist()
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-status]').hasText('Container is locked.')
    assert.dom('[data-container-items]').doesNotExist()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    assert.dom('[role="alert"]').doesNotExist()
    client.events.emit('Player:InteractionUpdated', null)
    assert.dom('[data-container-items]').doesNotExist()
  })

  test('verified empty inspection has explicit empty feedback without item action controls', async function(this: RenderingTestContext, assert) {
    provideContainerClient(async (client, targetId) => {
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'This container is empty.', inspected: true, items: [] })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.dom('[data-container-items] button').doesNotExist()
    assert.dom('[data-container-items] li').doesNotExist()
  })

  test('pending container approach guards other controls and teardown discards late contents', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners } = provideContainerClient((replica, targetId) => {
      replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'approaching',
        message: 'Approaching container…' })
      return new Promise<unknown>(resolve => { complete = resolve })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-status]').hasText('Approaching container…')
    assert.dom('[data-container-items]').doesNotExist()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('#container-target').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    await clearRender()
    assert.strictEqual(listeners.get('World:ContainersUpdated')!.size, 0)
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    client.events.emit('Player:InteractionUpdated', { kind: 'container', status: 'completed', inspected: true,
      items: [{ label: 'Late contents' }] })
    complete()
    assert.dom('[data-container-panel]').doesNotExist()
  })

  function provideInventoryClient(take: ItemAction, { known = true, items = [], canPut = false, put = async () => {} }: { known?: boolean; items?: Partial<FixtureItem>[]; canPut?: boolean; put?: ItemAction } = {}) {
    const item = { id: 'private-item-a', slot: 0, label: 'Item', type: 'Generic', prototypeId: 900003 }
    const fixture = provideContainerClient(async (client, targetId) => {
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true, revision: 5, canTake: known, canPut,
        items: [item, { id: 'private-weapon', slot: 1, label: 'Weapon', type: 'Weapon', prototypeId: 2001 }] })
    })
    fixture.client.inventoryState = { status: known ? 'ready' : 'unavailable', known, ownerId: '16086.json', items,
      message: known ? 'Inventory ready.' : 'Original actor inventory has not been recovered.' }
    fixture.client.authorityState.pause = { supported: true, paused: false }
    fixture.client.takeItem = (targetId, itemId) => take(fixture.client, targetId, itemId)
    fixture.client.putItem = (targetId, itemId) => put(fixture.client, targetId, itemId)
    return { ...fixture, item }
  }

  function providePutClient(put: ItemAction, take: ItemAction = async () => {}) {
    const ownedItem = { id: 'private-owned-item', slot: 0, label: 'Item <img src=x onerror=alert(1)>',
      type: 'Generic', prototypeId: 900003 }
    const weapon = { id: 'private-owned-weapon', slot: 1, label: 'Weapon', type: 'Weapon', prototypeId: 2001 }
    const fixture = provideInventoryClient(take, { items: [ownedItem, weapon], canPut: true, put })
    fixture.client.useTarget = async targetId => {
      fixture.client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true, revision: 5, canTake: true, canPut: true, items: [] })
    }
    return { ...fixture, ownedItem, weapon }
  }

  function provideTakeAllClient(takeAll: TargetAction, { known = true, contents = [
    { id: 'private-batch-a', slot: 3, label: 'Item A', type: 'Generic', prototypeId: 900003 },
    { id: 'private-batch-b', slot: 7, label: 'Item B', type: 'Generic', prototypeId: 900003 }
  ], items = [] }: { known?: boolean; contents?: FixtureItem[]; items?: Partial<FixtureItem>[] } = {}) {
    const individualCalls: {targetId: string; itemId: string}[] = []
    const fixture = provideInventoryClient(async (_client, targetId, itemId) => {
      individualCalls.push({ targetId, itemId })
    }, { known, items })
    fixture.client.useTarget = async targetId => {
      fixture.client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true, revision: 5, canTake: known, canPut: known, items: contents })
    }
    fixture.client.takeAllItems = targetId => takeAll(fixture.client, targetId)
    return { ...fixture, contents, individualCalls }
  }

  function provideGroundClient({ pickup = async () => {}, drop = async () => {}, known = true,
    items = [], groundItems = [{ id: 'visible-workshop-pebble', kind: 'ground', label: 'Workshop pebble',
      type: 'Generic', prototypeId: 900007, location: [4, 7] }] }: { pickup?: TargetAction; drop?: TargetAction; known?: boolean; items?: Partial<FixtureItem>[]; groundItems?: FixtureItem[] } = {}) {
    const fixture = provideInventoryClient(async () => {}, { known, items })
    fixture.client.authorityState.groundItems = groundItems
    fixture.client.pickupGroundItem = targetId => pickup(fixture.client, targetId)
    fixture.client.dropItem = itemId => drop(fixture.client, itemId)
    return { ...fixture, groundItems }
  }

  test('Ground Pickup and Drop wait for public floor and private inventory events', async function(this: RenderingTestContext, assert) {
    let completePickup!: (value?: unknown) => void , completeDrop!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client, groundItems: [pebble] } = provideGroundClient({ pickup(replica, targetId) {
      calls.push({ action: 'pickup', targetId })
      return new Promise<unknown>(resolve => { completePickup = () => {
        replica.events.emit('World:GroundItemsUpdated', [])
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [{ id: pebble.id, slot: 0, label: pebble.label, type: 'Generic', prototypeId: 900007, canDrop: true }],
          message: 'Item picked up.' })
        replica.events.emit('Player:GroundUpdated', { action: 'pickup', status: 'completed', message: 'Item picked up.' })
        resolve(undefined)
      } })
    }, drop(replica, itemId) {
      calls.push({ action: 'drop', itemId })
      return new Promise<unknown>(resolve => { completeDrop = () => {
        replica.events.emit('World:GroundItemsUpdated', [{ ...pebble, location: [4, 6] }])
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [], message: 'Your inventory is empty.' })
        replica.events.emit('Player:GroundUpdated', { action: 'drop', status: 'completed', message: 'Item dropped.' })
        resolve(undefined)
      } })
    } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-ground-panel]').exists()
    assert.dom('#ground-target option:checked').hasText('Workshop pebble 1')
    assert.dom('[data-ground-panel]').doesNotIncludeText(pebble.id)
    await click('[data-action="pickup-ground-item"]')
    assert.deepEqual(calls, [{ action: 'pickup', targetId: pebble.id }])
    client.events.emit('Player:InteractionUpdated', { kind: 'ground', targetId: pebble.id,
      status: 'pending', message: 'Approaching item…' })
    assert.dom('#door-target').hasValue('synthetic/door-a.json', 'a ground approach does not select a door')
    assert.dom('[data-ground-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('#ground-target').isDisabled()
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('#ground-target option').exists({ count: 1 }, 'the public item stays until the host removes it')
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    completePickup()
    await waitUntil(() => this.element.querySelector('[data-action="drop-item"]'))
    assert.dom('[data-ground-empty]').exists()
    assert.dom('[data-inventory-items] li span').hasText('Workshop pebble')
    assert.dom('[data-action="drop-item"]').hasAttribute('aria-label', 'Drop Workshop pebble')
    await click('[data-action="drop-item"]')
    assert.deepEqual(calls, [{ action: 'pickup', targetId: pebble.id }, { action: 'drop', itemId: pebble.id }])
    assert.dom('[data-action="drop-item"]').isDisabled()
    assert.dom('[data-inventory-items] li span').hasText('Workshop pebble', 'Drop does not remove a private row optimistically')
    assert.dom('[data-ground-empty]').exists()
    completeDrop()
    await waitUntil(() => !this.element.querySelector('[data-action="drop-item"]'))
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('#ground-target option:checked').hasText('Workshop pebble 1')
    assert.dom('[data-ground-status]').hasText('Item dropped.')
    assert.dom('[data-action="pickup-ground-item"]').isNotDisabled()
  })

  test('Drop requires an explicit Generic capability and escapes private labels', async function(this: RenderingTestContext, assert) {
    const label = 'Pebble <img src=x onerror="alert(1)"> & "stone"'
    provideGroundClient({ groundItems: [], items: [
      { id: 'eligible-pebble', slot: 0, label, type: 'Generic', prototypeId: 900007, canDrop: true },
      { id: 'ordinary-item', slot: 1, label: 'Item', type: 'Generic', prototypeId: 900003 },
      { id: 'unsupported-key', slot: 2, label: 'Key', type: 'Key', prototypeId: 900005, canDrop: true }
    ] })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-action="drop-item"]').exists({ count: 1 }, 'type alone never grants authored Drop behavior')
    assert.dom('[data-action="drop-item"]').hasAttribute('data-item-id', 'eligible-pebble')
    assert.dom('[data-action="drop-item"]').hasAttribute('aria-label', `Drop ${label}`)
    assert.dom('[data-action="drop-item"]').doesNotHaveAttribute('onerror')
    assert.dom('[data-inventory-items] li:first-child span').hasText(label)
    assert.dom('[data-inventory-items] img').doesNotExist()
    assert.dom('[data-action="put-item"]').doesNotExist('Drop does not require selecting or inspecting a container')
  })

  test('Ground rejection is escaped and preserves verified floor and inventory rows', async function(this: RenderingTestContext, assert) {
    const message = 'Item moved. <img src=x onerror=alert(1)>'
    provideGroundClient({ pickup: async () => { throw new Error(message) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="pickup-ground-item"]')
    assert.dom('[data-ground-status]').hasText(message)
    assert.dom('[data-ground-status] img').doesNotExist()
    assert.dom('#ground-target option').exists({ count: 1 })
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-action="pickup-ground-item"]').isNotDisabled()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
  })

  test('pause, checkpoint and unknown ownership disable Ground commands and teardown ignores late events', async function(this: RenderingTestContext, assert) {
    let finish!: (value?: unknown) => void
    const { client, listeners, groundItems } = provideGroundClient({ pickup: () => new Promise<unknown>(resolve => { finish = resolve }) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, status: 'completed', message: 'Paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="pickup-ground-item"]')!.disabled)
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, status: 'completed', message: 'Running.' })
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Loading checkpoint…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="pickup-ground-item"]')!.disabled)
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    client.events.emit('Player:CheckpointUpdated', { status: 'completed', message: 'Checkpoint loaded.' })
    client.events.emit('Player:InventoryUpdated', { status: 'unavailable', known: false, items: [], message: 'Inventory unavailable.' })
    await waitUntil(() => !this.element.querySelector('[data-inventory-items]'))
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    assert.dom('[data-action="drop-item"]').doesNotExist()
    client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json', items: [], message: 'Inventory ready.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="pickup-ground-item"]')!.disabled)
    await click('[data-action="pickup-ground-item"]')
    await clearRender()
    assert.strictEqual(listeners.get('World:GroundItemsUpdated')!.size, 0)
    assert.strictEqual(listeners.get('Player:GroundUpdated')!.size, 0)
    client.events.emit('World:GroundItemsUpdated', groundItems)
    client.events.emit('Player:GroundUpdated', { status: 'completed', message: 'Late pickup.' })
    finish()
    assert.dom('[data-ground-panel]').doesNotExist()
    assert.dom('[data-inventory-panel]').doesNotExist()
  })

  test('Take submits the inspected Generic item and waits for private owner updates', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client, item } = provideInventoryClient((replica, targetId, itemId) => {
      calls.push({ targetId, itemId })
      return new Promise<unknown>(resolve => { complete = () => {
        replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
          message: 'Item taken.', inspected: true, revision: 6, canTake: true, items: [] })
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [{ ...item, label: 'Item <img src=x onerror=alert(1)>' }], message: 'Inventory ready.' })
        resolve(undefined)
      } })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-inventory-panel]').exists()
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-inventory-panel]').doesNotIncludeText('16086.json')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-item"]').exists({ count: 1 }, 'equipment is outside the supported Take subset')
    await click('[data-action="take-item"]')
    assert.deepEqual(calls, [{ targetId: 'synthetic/container-a.json', itemId: item.id }])
    assert.dom('[data-container-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-action="take-item"]').isDisabled()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.', 'ownership is not changed optimistically')
    assert.dom('[data-container-items] li').exists({ count: 2 })
    assert.strictEqual(client.inventoryState!.items.length, 0, 'the view never mutates the client inventory')
    complete()
    await waitUntil(() => !this.element.querySelector('[data-action="take-item"]'))
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.dom('[data-inventory-items] li').hasText('Item <img src=x onerror=alert(1)>')
    assert.dom('[data-inventory-items] img').doesNotExist()
    assert.dom('[data-inventory-panel]').doesNotIncludeText('private-item-a')
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
  })

  test('standalone Key Take and Put submit private item identities and wait for server owner events', async function(this: RenderingTestContext, assert) {
    let completeTake!: (value?: unknown) => void , completePut!: (value?: unknown) => void
    const calls: unknown[] = []
    const key = { id: 'private-standalone-key', slot: 3, label: 'Key', type: 'Key', prototypeId: 900005 }
    const ownedKey = { ...key, slot: 0 }
    const { client } = provideInventoryClient((replica, targetId, itemId) => {
      calls.push({ kind: 'take', targetId, itemId })
      return new Promise<unknown>(resolve => { completeTake = () => {
        replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
          message: 'Item taken.', inspected: true, revision: 6, canTake: true, canPut: true, items: [] })
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [ownedKey], message: 'Inventory ready.' })
        resolve(undefined)
      } })
    }, { canPut: true, put(replica, targetId, itemId) {
      calls.push({ kind: 'put', targetId, itemId })
      return new Promise<unknown>(resolve => { completePut = () => {
        replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
          message: 'Item put in container.', inspected: true, revision: 7, canTake: true, canPut: true,
          items: [{ ...key, slot: 0 }] })
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [], message: 'Inventory ready.' })
        resolve(undefined)
      } })
    } })
    client.useTarget = async targetId => {
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true, revision: 5, canTake: true, canPut: true, items: [key] })
    }
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-container-items] li span').hasText('Key')
    assert.dom('[data-action="take-item"]').hasAttribute('data-item-id', key.id)
    await click('[data-action="take-item"]')
    assert.deepEqual(calls, [{ kind: 'take', targetId: 'synthetic/container-a.json', itemId: key.id }])
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-container-items] li span').hasText('Key', 'the source remains visible while the host decides')
    assert.dom('[data-action="take-item"]').isDisabled()
    completeTake()
    await waitUntil(() => this.element.querySelector('[data-action="put-item"]'))
    assert.dom('[data-inventory-items] li span').hasText('Key')
    assert.dom('[data-action="put-item"]').hasAttribute('aria-label', 'Put Key in selected container')
    await click('[data-action="put-item"]')
    assert.deepEqual(calls, [
      { kind: 'take', targetId: 'synthetic/container-a.json', itemId: key.id },
      { kind: 'put', targetId: 'synthetic/container-a.json', itemId: key.id }
    ])
    assert.dom('[data-inventory-items] li span').hasText('Key', 'putting does not change ownership optimistically')
    assert.dom('[data-container-items]').hasText('This container is empty.')
    completePut()
    await waitUntil(() => !this.element.querySelector('[data-action="put-item"]'))
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-container-items] li span').hasText('Key')
    assert.dom('[data-action="take-item"]').exists()
    assert.dom('[data-container-panel]').doesNotIncludeText(key.id)
    assert.dom('[data-inventory-panel]').doesNotIncludeText('900005')
    assert.deepEqual(client.inventoryState!.items, [], 'the component never edits the client inventory itself')
  })

  test('a locked container uses private server access and clears its inspection after a held key is put away', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const target = 'synthetic/container-b.json'
    const key = { id: 'private-lock-key', slot: 0, label: 'Key', type: 'Key', prototypeId: 900005 }
    const prize = { id: 'private-locked-prize', slot: 3, label: 'Workshop keepsake', type: 'Generic', prototypeId: 900006 }
    const message = 'Container is locked; hold a matching key. <img src=x onerror=alert(1)>'
    let held = true
    const { client } = provideInventoryClient(async (_replica, targetId, itemId) => {
      calls.push({ kind: 'take', targetId, itemId })
      throw new Error(message)
    }, { items: [key], canPut: true, put: async (replica, targetId, itemId) => {
      calls.push({ kind: 'put', targetId, itemId })
      held = false
      replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Item put in container.', inspected: true, revision: 6, canTake: true, canPut: true,
        items: [prize, { ...key, slot: 0 }] })
      replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
        items: [], message: 'Your inventory is empty.' })
    } })
    client.authorityState.containers![1] = { ...client.authorityState.containers![1], usable: true,
      reason: 'A matching held key is required.' }
    client.useTarget = async (...args) => {
      calls.push({ kind: 'use', args })
      if (!held) throw new Error(message)
      client.events.emit('Player:InteractionUpdated', { targetId: args[0], kind: 'container', status: 'completed',
        message: 'Container inspected.', inspected: true, revision: 5, canTake: true, canPut: true, items: [prize] })
    }
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    this.element.querySelector<HTMLSelectElement>('#container-target')!.value = target
    await triggerEvent('#container-target', 'change')
    await click('[data-action="inspect-container"]')
    assert.deepEqual(calls, [{ kind: 'use', args: [target] }], 'the view submits only the target, without a key decision')
    assert.dom('#container-target option:checked').hasText('Container 2 (locked)')
    assert.dom('[data-container-items] li span').hasText(prize.label)
    assert.dom('[data-container-panel]').includesText('A matching held key is required.')
    assert.dom('[data-inventory-items] li span').hasText('Key')
    await click('[data-action="put-item"]')
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('#container-target option:checked').hasText('Container 2 (locked)', 'access never clears the public lock')
    assert.dom('[data-container-items] li').exists({ count: 2 })
    await click('[data-action="take-item"][data-item-id="private-locked-prize"]')
    assert.deepEqual(calls, [
      { kind: 'use', args: [target] },
      { kind: 'put', targetId: target, itemId: key.id },
      { kind: 'take', targetId: target, itemId: prize.id }
    ], 'each new transfer remains a server request after access changes')
    assert.dom('[data-container-status]').hasText(message)
    assert.dom('[data-container-status] img').doesNotExist()
    assert.dom('[data-container-items]').doesNotExist('denial clears previously authorized private rows')
    assert.dom('[data-action="take-all-items"]').doesNotExist()
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-action="inspect-container"]').isNotDisabled('the player can retry after recovering a key')
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
  })

  test('Take rejection clears stale container contents and preserves a verified actor inventory', async function(this: RenderingTestContext, assert) {
    const message = 'Item changed. <img src=x onerror=alert(1)>'
    provideInventoryClient(async () => { throw new Error(message) }, {
      items: [{ id: 'owned-safe-item', slot: 0, label: 'Existing item', type: 'Generic', prototypeId: 900003 }]
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    await click('[data-action="take-item"]')
    assert.dom('[data-container-items]').doesNotExist()
    assert.dom('[data-container-status]').hasText(message)
    assert.dom('[data-container-status] img').doesNotExist()
    assert.dom('[data-inventory-items] li').hasText('Existing item')
    assert.dom('[data-action="inspect-container"]').isNotDisabled()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
  })

  test('paused, checkpoint and inventory requests disable Take without changing owner lists', async function(this: RenderingTestContext, assert) {
    const { client } = provideInventoryClient(async () => assert.step('unexpected take'))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, status: 'completed', message: 'Local game paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="take-item"]')!.disabled)
    assert.dom('[data-action="take-item"]').isDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, status: 'completed', message: 'Local game running.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="take-item"]')!.disabled)
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Saving checkpoint…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="take-item"]')!.disabled)
    assert.dom('[data-action="take-item"]').isDisabled()
    client.events.emit('Player:CheckpointUpdated', { status: 'completed', message: 'Checkpoint saved.' })
    client.events.emit('Player:InventoryUpdated', { status: 'pending', known: false, items: [], message: 'Refreshing inventory…' })
    await waitUntil(() => this.element.querySelector('[data-inventory-status]')!.textContent!.includes('Refreshing'))
    assert.dom('[data-action="take-item"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-inventory-items]').doesNotExist()
    assert.verifySteps([])
  })

  test('unknown original actor inventory is never displayed as empty or offered Take', async function(this: RenderingTestContext, assert) {
    const { client } = provideInventoryClient(async () => assert.step('unexpected take'), { known: false,
      items: [{ label: 'Unverified private row' }] })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-inventory-status]').hasText('Original actor inventory has not been recovered.')
    assert.dom('[data-inventory-items]').doesNotExist()
    assert.dom('[data-inventory-panel]').doesNotIncludeText('empty')
    assert.dom('[data-inventory-panel]').doesNotIncludeText('Unverified private row')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-item"]').doesNotExist()
    assert.dom('[data-action="take-all-items"]').doesNotExist()
    assert.dom('[data-action="put-item"]').doesNotExist()
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, canTake: true, canPut: true,
      items: [{ id: 'item', type: 'Generic', label: 'Item' }] })
    await waitUntil(() => this.element.querySelector('[data-action="take-item"]'))
    assert.dom('[data-action="take-item"]').isDisabled('a stale capability cannot bypass unknown actor inventory')
    assert.dom('[data-action="take-all-items"]').doesNotExist('unknown actor ownership cannot authorize a batch')
    assert.dom('[data-action="put-item"]').doesNotExist('a stale capability cannot display unverified inventory')
    assert.verifySteps([])
  })

  test('load invalidation clears private owner views until replacement inventory arrives', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client } = provideInventoryClient(async () => {}, {
      items: [{ label: 'Previous item', type: 'Generic', id: 'previous', slot: 0, prototypeId: 900003 }], canPut: true
    })
    client.loadCheckpoint = () => {
      client.events.emit('Player:InteractionUpdated', null)
      client.events.emit('Player:InventoryUpdated', { status: 'pending', known: false, items: [], message: 'Refreshing inventory…' })
      return new Promise<unknown>(resolve => { complete = () => {
        client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [], message: 'Inventory ready.' })
        resolve({ savedAt: '2026-10-12T12:00:00.000Z' })
      } })
    }
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="put-item"]').exists()
    await click('[data-action="load-checkpoint"]')
    assert.dom('[data-container-items]').doesNotExist()
    assert.dom('[data-inventory-items]').doesNotExist()
    assert.dom('[data-inventory-panel]').doesNotIncludeText('Previous item')
    assert.dom('[data-action="put-item"]').doesNotExist()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    complete()
    await waitUntil(() => this.element.querySelector('[data-inventory-items]'))
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.dom('[data-checkpoint-status]').hasText('Checkpoint loaded.')
    assert.dom('[data-container-items]').doesNotExist('load never restores a stale inspection')
  })

  test('private descriptive inventory names and Put accessibility labels render as escaped text', async function(this: RenderingTestContext, assert) {
    const { ownedItem } = providePutClient(async () => {})
    ownedItem.label = 'Workshop <img src=x onerror="alert(1)"> "token" & <svg onload="alert(2)">'
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-inventory-items] li:first-child span').hasText(ownedItem.label)
    assert.dom('[data-inventory-items] img').doesNotExist()
    assert.dom('[data-inventory-items] svg').doesNotExist()
    assert.dom('[data-inventory-panel]').doesNotIncludeText(ownedItem.id)
    assert.dom('[data-inventory-panel]').doesNotIncludeText('900003')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="put-item"]').hasAttribute('aria-label', `Put ${ownedItem.label} in selected container`)
    assert.dom('[data-action="put-item"]').doesNotHaveAttribute('onerror')
    assert.dom('[data-action="put-item"]').doesNotHaveAttribute('onload')
    assert.dom('[data-inventory-items] li:first-child span').hasText(ownedItem.label)
    assert.dom('[data-inventory-items] img').doesNotExist()
    assert.dom('[data-inventory-items] svg').doesNotExist()
  })

  test('Put waits for private owner updates and permits retaking the returned item', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client, ownedItem, weapon } = providePutClient((replica, targetId, itemId) => {
      calls.push({ kind: 'put', targetId, itemId })
      return new Promise<unknown>(resolve => { complete = () => {
        replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
          message: 'Item put in container.', inspected: true, revision: 6, canTake: true, canPut: true, items: [ownedItem] })
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: [weapon], message: 'Inventory ready.' })
        resolve(undefined)
      } })
    }, async (replica, targetId, itemId) => {
      calls.push({ kind: 'take', targetId, itemId })
      replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'Item taken.', inspected: true, revision: 7, canTake: true, canPut: true, items: [] })
      replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
        items: [ownedItem, weapon], message: 'Inventory ready.' })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-action="put-item"]').doesNotExist('a selected but uninspected container grants no capability')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="put-item"]').exists({ count: 1 }, 'equipment cannot be put by this subset')
    assert.dom('[data-action="put-item"]').hasAttribute('data-item-id', ownedItem.id)
    assert.dom('[data-action="put-item"]').hasAttribute('aria-label', `Put ${ownedItem.label} in selected container`)
    assert.dom('[data-inventory-items] img').doesNotExist()
    await click('[data-action="put-item"]')
    assert.deepEqual(calls, [{ kind: 'put', targetId: 'synthetic/container-a.json', itemId: ownedItem.id }])
    assert.dom('[data-inventory-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-container-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-action="put-item"]').isDisabled()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('#container-target').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-inventory-items] li').exists({ count: 2 }, 'private rows do not change before the response')
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.strictEqual(client.inventoryState!.items.length, 2, 'the view never rewrites the client owner list')
    complete()
    await waitUntil(() => !this.element.querySelector('[data-action="put-item"]'))
    assert.dom('[data-inventory-items] li').hasText('Weapon')
    assert.dom('[data-container-items] li span').hasText(ownedItem.label)
    assert.dom('[data-action="take-item"]').hasAttribute('data-item-id', ownedItem.id)
    await click('[data-action="take-item"]')
    assert.deepEqual(calls, [
      { kind: 'put', targetId: 'synthetic/container-a.json', itemId: ownedItem.id },
      { kind: 'take', targetId: 'synthetic/container-a.json', itemId: ownedItem.id }
    ])
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.dom('[data-inventory-items] li').exists({ count: 2 })
    assert.dom('[data-action="put-item"]').isNotDisabled('the fresh returned inspection supports another Put')
    assert.dom('[data-inventory-panel]').doesNotIncludeText(ownedItem.id)
  })

  test('Put rejection clears the stale inspection and preserves verified actor rows', async function(this: RenderingTestContext, assert) {
    const message = 'Container changed. <img src=x onerror=alert(1)>'
    const { ownedItem } = providePutClient(async () => { throw new Error(message) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    await click('[data-action="put-item"]')
    assert.dom('[data-container-status]').hasText(message)
    assert.dom('[data-container-status] img').doesNotExist()
    assert.dom('[data-container-items]').doesNotExist()
    assert.dom('[data-action="put-item"]').doesNotExist('rejected contents cannot authorize another transfer')
    assert.dom('[data-inventory-items] li:first-child span').hasText(ownedItem.label)
    assert.dom('[data-inventory-items] li').exists({ count: 2 })
    assert.dom('[data-action="inspect-container"]').isNotDisabled()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="put-item"]').isNotDisabled('a fresh inspection can recover from rejection')
  })

  test('Put requires a fresh completed inspection of the selected container', async function(this: RenderingTestContext, assert) {
    const { client } = providePutClient(async () => assert.step('unexpected put'))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="put-item"]').isNotDisabled()
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, revision: 5, canTake: false, canPut: false, items: [], message: 'Inspect again.' })
    await waitUntil(() => !this.element.querySelector('[data-action="put-item"]'))
    assert.dom('[data-action="put-item"]').doesNotExist('an expired capability cannot authorize Put')
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'approaching', inspected: true, canPut: true, items: [], message: 'Approaching container…' })
    await waitUntil(() => this.element.querySelector('[data-container-status]')!.textContent!.includes('Approaching'))
    assert.dom('[data-action="put-item"]').doesNotExist('approach state cannot reuse a prior capability')
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, revision: 6, canTake: true, canPut: true, items: [], message: 'Container inspected.' })
    await waitUntil(() => this.element.querySelector('[data-action="put-item"]'))
    this.element.querySelector<HTMLSelectElement>('#container-target')!.value = 'synthetic/container-b.json'
    await triggerEvent('#container-target', 'change')
    assert.dom('[data-action="put-item"]').doesNotExist('selection changes discard the inspected target')
    assert.dom('[data-container-items]').doesNotExist()
    assert.verifySteps([])
  })

  test('pause, checkpoint and unknown inventory guard Put without changing ownership', async function(this: RenderingTestContext, assert) {
    const { client } = providePutClient(async () => assert.step('unexpected put'))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, status: 'completed', message: 'Local game paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="put-item"]')!.disabled)
    assert.dom('[data-action="put-item"]').isDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, status: 'completed', message: 'Local game running.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="put-item"]')!.disabled)
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Loading checkpoint…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="put-item"]')!.disabled)
    assert.dom('[data-action="put-item"]').isDisabled()
    assert.dom('[data-inventory-items] li').exists({ count: 2 })
    client.events.emit('Player:CheckpointUpdated', { status: 'completed', message: 'Checkpoint loaded.' })
    client.events.emit('Player:InventoryUpdated', { status: 'pending', known: true,
      items: client.inventoryState!.items, message: 'Refreshing inventory…' })
    await waitUntil(() => !this.element.querySelector('[data-action="put-item"]'))
    assert.dom('[data-action="put-item"]').doesNotExist('a pending read cannot authorize a transfer')
    assert.dom('[data-action="inspect-container"]').isDisabled()
    client.events.emit('Player:InventoryUpdated', { status: 'unavailable', known: false,
      items: client.inventoryState!.items, message: 'Actor inventory is unknown.' })
    await waitUntil(() => !this.element.querySelector('[data-inventory-items]'))
    assert.dom('[data-action="put-item"]').doesNotExist()
    assert.dom('[data-inventory-items]').doesNotExist('unverified rows remain private and unavailable')
    assert.dom('[data-inventory-status]').hasText('Actor inventory is unknown.')
    assert.verifySteps([])
  })

  test('teardown removes private subscriptions before a late Put response', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners, ownedItem } = providePutClient(() => new Promise<unknown>(resolve => { complete = resolve }))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    await click('[data-action="put-item"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:InventoryUpdated')!.size, 0)
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, canPut: true, canTake: true, items: [ownedItem] })
    client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, items: [] })
    complete()
    assert.dom('[data-inventory-panel]').doesNotExist()
    assert.dom('[data-container-panel]').doesNotExist()
    assert.dom('[data-action="put-item"]').doesNotExist()
  })

  test('Take All submits one container batch and waits for both private owner updates', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client, contents, individualCalls } = provideTakeAllClient((replica, targetId) => {
      calls.push(targetId)
      return new Promise<unknown>(resolve => { complete = () => {
        replica.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
          message: 'All items taken.', inspected: true, revision: 6, canTake: true, canPut: true, items: [] })
        replica.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
          items: contents.map((item, slot) => ({ ...item, slot })), message: 'Inventory ready.' })
        resolve(undefined)
      } })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-action="take-all-items"]').doesNotExist('public selection alone grants no batch capability')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-all-items"]').hasText('Take All')
    assert.dom('[data-action="take-item"]').exists({ count: 2 })
    await click('[data-action="take-all-items"]')
    assert.deepEqual(calls, ['synthetic/container-a.json'], 'one intention identifies only the inspected container')
    assert.deepEqual(individualCalls, [], 'the view does not loop over individual Take commands')
    assert.dom('[data-action="take-all-items"]').isDisabled()
    assert.dom('[data-action="take-item"]').isDisabled()
    assert.dom('[data-container-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-inventory-panel]').hasAttribute('aria-busy', 'true')
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('#container-target').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-container-items] li').exists({ count: 2 }, 'rows stay in the source until the response')
    assert.dom('[data-inventory-items]').hasText('Your inventory is empty.')
    assert.strictEqual(client.inventoryState!.items.length, 0, 'the view does not grant ownership optimistically')
    complete()
    await waitUntil(() => !this.element.querySelector('[data-action="take-all-items"]'))
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.dom('[data-inventory-items] li').exists({ count: 2 })
    assert.dom('[data-inventory-items] li:nth-child(1) span').hasText('Item A')
    assert.dom('[data-inventory-items] li:nth-child(2) span').hasText('Item B')
    assert.dom('[data-action="put-item"]').exists({ count: 2 }, 'both refreshed private inventory rows can be returned')
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
  })

  test('Take All includes a standalone Key beside a simple item without selecting keys locally', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const contents = [
      { id: 'private-key-batch-item', slot: 3, label: 'Item', type: 'Generic', prototypeId: 900003 },
      { id: 'private-key-batch-key', slot: 8, label: 'Key', type: 'Key', prototypeId: 900005 }
    ]
    const { individualCalls } = provideTakeAllClient(async (client, targetId) => {
      calls.push(targetId)
      client.events.emit('Player:InteractionUpdated', { targetId, kind: 'container', status: 'completed',
        message: 'All items taken.', inspected: true, revision: 6, canTake: true, canPut: true, items: [] })
      client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, ownerId: '16086.json',
        items: contents.map((item, slot) => ({ ...item, slot })), message: 'Inventory ready.' })
    }, { contents })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-item"]').exists({ count: 2 })
    await click('[data-action="take-all-items"]')
    assert.deepEqual(calls, ['synthetic/container-a.json'])
    assert.deepEqual(individualCalls, [], 'the server chooses the complete source set')
    assert.dom('[data-container-items]').hasText('This container is empty.')
    assert.dom('[data-inventory-items] li:nth-child(1) span').hasText('Item')
    assert.dom('[data-inventory-items] li:nth-child(2) span').hasText('Key')
    assert.dom('[data-action="put-item"]').exists({ count: 2 })
  })

  test('Take All rejection reports the whole mixed batch without taking a supported subset', async function(this: RenderingTestContext, assert) {
    const message = 'Batch contains an unsupported item. <img src=x onerror=alert(1)>'
    const calls: unknown[] = []
    const { individualCalls } = provideTakeAllClient(async (_client, targetId) => {
      calls.push(targetId)
      throw new Error(message)
    }, { contents: [
      { id: 'batch-generic', slot: 0, label: 'Item', type: 'Generic', prototypeId: 900003 },
      { id: 'batch-key', slot: 1, label: 'Key', type: 'Key', prototypeId: 900005 },
      { id: 'batch-gold', slot: 2, label: 'Gold', type: 'Gold', prototypeId: 900006 }
    ], items: [{ id: 'existing-safe', slot: 0, label: 'Existing item', type: 'Generic', prototypeId: 900003 }] })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-all-items"]').isNotDisabled('the server evaluates the whole batch')
    assert.dom('[data-action="take-item"]').exists({ count: 2 }, 'simple items and keys are offered, while gold is unsupported')
    await click('[data-action="take-all-items"]')
    assert.deepEqual(calls, ['synthetic/container-a.json'])
    assert.deepEqual(individualCalls, [], 'unsupported contents do not trigger a silent subset')
    assert.dom('[data-container-status]').hasText(message)
    assert.dom('[data-container-status] img').doesNotExist()
    assert.dom('[data-container-items]').doesNotExist('the stale inspection is cleared after rejection')
    assert.dom('[data-action="take-all-items"]').doesNotExist()
    assert.dom('[data-inventory-items] li span').hasText('Existing item')
    assert.dom('[data-inventory-items] li').exists({ count: 1 })
    assert.dom('[data-action="inspect-container"]').isNotDisabled()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
  })

  test('Take All is unavailable for stale, incomplete, empty or unknown private state', async function(this: RenderingTestContext, assert) {
    const { client, contents, individualCalls } = provideTakeAllClient(async () => assert.step('unexpected batch'))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    assert.dom('[data-action="take-all-items"]').isNotDisabled()
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, revision: 5, canTake: false, items: contents, message: 'Inspect again.' })
    await waitUntil(() => !this.element.querySelector('[data-action="take-all-items"]'))
    assert.dom('[data-action="take-all-items"]').doesNotExist('expired private capability is unavailable')
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'approaching', inspected: true, canTake: true, items: contents, message: 'Approaching container…' })
    await waitUntil(() => this.element.querySelector('[data-container-status]')!.textContent!.includes('Approaching'))
    assert.dom('[data-action="take-all-items"]').doesNotExist('approach state cannot reuse prior contents')
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, revision: 6, canTake: true, items: [], message: 'This container is empty.' })
    await waitUntil(() => !this.element.querySelector('[data-container-items] li'))
    assert.dom('[data-action="take-all-items"]').doesNotExist('empty batches have no action')
    client.events.emit('Player:InventoryUpdated', { status: 'unavailable', known: false, items: [], message: 'Actor inventory is unknown.' })
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, revision: 7, canTake: true, items: contents, message: 'Container inspected.' })
    await waitUntil(() => this.element.querySelector('[data-container-items] li'))
    assert.dom('[data-action="take-all-items"]').doesNotExist('unknown actor ownership overrides a stale capability')
    assert.dom('[data-inventory-items]').doesNotExist()
    assert.deepEqual(individualCalls, [])
    assert.verifySteps([])
  })

  test('pause, checkpoint and inventory reads guard Take All', async function(this: RenderingTestContext, assert) {
    const { client } = provideTakeAllClient(async () => assert.step('unexpected batch'))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, status: 'completed', message: 'Local game paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="take-all-items"]')!.disabled)
    assert.dom('[data-action="take-all-items"]').isDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, status: 'completed', message: 'Local game running.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="take-all-items"]')!.disabled)
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Saving checkpoint…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="take-all-items"]')!.disabled)
    assert.dom('[data-action="take-all-items"]').isDisabled()
    client.events.emit('Player:CheckpointUpdated', { status: 'completed', message: 'Checkpoint saved.' })
    client.events.emit('Player:InventoryUpdated', { status: 'pending', known: true, items: [], message: 'Refreshing inventory…' })
    await waitUntil(() => !this.element.querySelector('[data-action="take-all-items"]'))
    assert.dom('[data-action="take-all-items"]').doesNotExist('pending inventory is not ready for a batch')
    assert.verifySteps([])
  })

  test('teardown removes private subscriptions before a late Take All response', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners, contents } = provideTakeAllClient(() => new Promise<unknown>(resolve => { complete = resolve }))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    await click('[data-action="take-all-items"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:InventoryUpdated')!.size, 0)
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/container-a.json', kind: 'container',
      status: 'completed', inspected: true, canTake: true, items: [] })
    client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, items: contents })
    complete()
    assert.dom('[data-inventory-panel]').doesNotExist()
    assert.dom('[data-container-panel]').doesNotExist()
    assert.dom('[data-action="take-all-items"]').doesNotExist()
  })

  test('teardown removes inventory subscriptions and ignores a late Take result', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners } = provideInventoryClient(() => new Promise<unknown>(resolve => { complete = resolve }))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="inspect-container"]')
    await click('[data-action="take-item"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:InventoryUpdated')!.size, 0)
    assert.strictEqual(listeners.get('Player:InteractionUpdated')!.size, 0)
    client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, items: [{ label: 'Late item' }] })
    client.events.emit('Player:InteractionUpdated', { kind: 'container', inspected: true, items: [] })
    complete()
    assert.dom('[data-inventory-panel]').doesNotExist()
    assert.dom('[data-container-panel]').doesNotExist()
  })

  test('runtime failure removes the inventory subscription as the map stops', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = provideInventoryClient(async () => {})
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Server connection lost'))
    await waitUntil(() => !this.element.querySelector('[data-inventory-panel]'))
    assert.strictEqual(listeners.get('Player:InventoryUpdated')!.size, 0)
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })

  function provideConversationClient({ begin = async () => {}, reply = async () => {}, refresh = async () => {},
    conversation = { status: 'closed', message: 'Choose a character to talk.' },
    journal = { status: 'ready', message: 'Journal ready.', entries: [] }, known = true }: { begin?: TargetAction; reply?: TargetAction; refresh?: ClientAction; conversation?: FixtureClient['conversationState']; journal?: FixtureClient['journalState']; known?: boolean } = {}) {
    const fixture = provideGroundClient({ known })
    const target = { id: 'synthetic/workshop-guide.json', kind: 'conversation', label: 'Workshop guide',
      location: [9, 8], text: 'Never display public dialogue text', options: [{ id: 'untrusted', text: 'Never display public options' }] }
    fixture.client.authorityState.conversationTargets = [target]
    fixture.client.conversationState = conversation
    fixture.client.journalState = journal
    fixture.client.beginConversation = targetId => begin(fixture.client, targetId)
    fixture.client.replyConversation = optionId => reply(fixture.client, optionId)
    fixture.client.refreshJournal = () => refresh(fixture.client)
    fixture.client.closeConversation = () => fixture.client.events.emit('Player:ConversationUpdated',
      { status: 'closed', message: 'Conversation closed.' })
    return { ...fixture, target }
  }

  test('Conversation and Journal use private events without optimistic quest progress or public choices', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    let finishBegin!: (value?: unknown) => void , finishReply!: (value?: unknown) => void
    const { client, target } = provideConversationClient({
      begin(replica, targetId) {
        calls.push({ action: 'begin', targetId })
        return new Promise<unknown>(resolve => { finishBegin = () => {
          replica.events.emit('Player:ConversationUpdated', { status: 'ready', targetId, speaker: 'Workshop guide',
            text: 'Would you look for the workshop pebble?', message: 'Choose a reply.', revision: 5,
            options: [{ id: 'accept', text: 'I will look for it.' }, { id: 'leave', text: 'Goodbye.' }] })
          resolve(undefined)
        } })
      },
      reply(replica, optionId) {
        calls.push({ action: 'reply', optionId })
        return new Promise<unknown>(resolve => { finishReply = () => {
          replica.events.emit('Player:ConversationUpdated', { status: 'ready', targetId: target.id, speaker: 'Workshop guide',
            text: 'Bring the pebble here.', message: 'Choose a reply.', revision: 6,
            options: [{ id: 'leave', text: 'Goodbye.' }] })
          replica.events.emit('Player:JournalUpdated', { status: 'ready', message: 'Journal updated.',
            entries: [{ id: 'a-closer-look', title: 'A closer look', status: 'active', text: 'Show the workshop pebble to the guide.' }] })
          resolve(undefined)
        } })
      }
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.deepEqual(calls, [], 'startup renders existing private state without starting a conversation')
    assert.dom('[data-conversation-panel]').doesNotIncludeText('Never display public')
    assert.dom('[data-action="reply-conversation"]').doesNotExist()
    assert.dom('[data-journal-entries]').includesText('No journal entries yet.')
    await click('[data-action="begin-conversation"]')
    assert.deepEqual(calls, [{ action: 'begin', targetId: target.id }], 'only the selected public target reaches the client method')
    assert.dom('[data-conversation-status]').hasText('Approaching character…')
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    assert.dom('[data-action="refresh-journal"]').isDisabled()
    finishBegin()
    await waitUntil(() => this.element.querySelector('[data-action="reply-conversation"]'))
    assert.dom('[data-conversation-text]').hasText('Would you look for the workshop pebble?')
    assert.dom('[data-conversation-content]').isFocused('private dialogue receives keyboard focus inside the scroll stack')
    assert.dom('[data-action="reply-conversation"]').exists({ count: 2 })
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled('an idle open page does not trap unrelated controls')
    await click('[data-option-id="accept"]')
    assert.deepEqual(calls[1], { action: 'reply', optionId: 'accept' }, 'UI forwards only the server-provided option identifier')
    assert.dom('[data-journal-entries]').includesText('No journal entries yet.', 'clicking a reply does not create quest progress')
    assert.dom('[data-action="reply-conversation"]').doesNotExist('pending replies cannot be submitted again')
    finishReply()
    await waitUntil(() => this.element.querySelector('[data-quest-id="a-closer-look"]'))
    assert.dom('[data-quest-id="a-closer-look"]').hasAttribute('data-quest-status', 'active')
    assert.dom('[data-conversation-text]').hasText('Bring the pebble here.')
    assert.dom('[data-action="reply-conversation"]').exists({ count: 1 })
    client.events.emit('Player:InventoryUpdated', { status: 'ready', known: true, items: [{ id: 'held-pebble', type: 'Generic', label: 'Pebble' }] })
    assert.dom('[data-option-id="show"]').doesNotExist('held inventory cannot invent an unoffered reply')
    await click('[data-action="close-conversation"]')
    assert.dom('[data-conversation-content]').doesNotExist()
    assert.dom('[data-conversation-status]').hasText('Conversation closed.')
    assert.dom('[data-quest-id="a-closer-look"]').hasAttribute('data-quest-status', 'active', 'local close does not reset persistent progress')
  })

  test('dialogue, choices and journal are escaped plain text in one right interaction stack', async function(this: RenderingTestContext, assert) {
    const markup = '<img src=x onerror=alert(1)>'
    const calls: unknown[] = []
    provideConversationClient({ conversation: { status: 'ready', targetId: 'synthetic/workshop-guide.json',
      speaker: `Guide ${markup}`, text: `Private line ${markup}`, message: 'Choose a reply.',
      options: [{ id: 'leave', text: `Reply ${markup}` }] },
    journal: { status: 'ready', message: `Private journal ${markup}`,
      entries: [{ id: 'a-closer-look', title: `Quest ${markup}`, status: 'completed', text: `Finished ${markup}` }] },
    reply: async (_replica, optionId) => { calls.push(optionId); throw new Error(`Reply rejected ${markup}`) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-conversation-panel]').includesText(`Guide ${markup}`)
    assert.dom('[data-conversation-text]').hasText(`Private line ${markup}`)
    assert.dom('[data-option-id="leave"]').hasText(`Reply ${markup}`)
    assert.dom('[data-journal-panel]').includesText(`Quest ${markup}`)
    assert.dom('[data-journal-panel]').includesText(`Finished ${markup}`)
    assert.dom('[data-conversation-panel] img, [data-journal-panel] img').doesNotExist()
    for (const selector of ['[data-interaction-panel]', '[data-container-panel]', '[data-conversation-panel]', '[data-journal-panel]']) {
      assert.dom(`[data-interaction-stack] ${selector}`).exists('each right panel participates in the same scroll region')
      assert.strictEqual(getComputedStyle(this.element.querySelector(selector)!).position, 'static')
    }
    assert.dom('[data-inventory-panel] [data-conversation-panel]').doesNotExist()
    assert.strictEqual(getComputedStyle(this.element.querySelector('[data-interaction-stack]')!).overflowY, 'auto')
    await click('[data-option-id="leave"]')
    assert.deepEqual(calls, ['leave'])
    assert.dom('[data-conversation-status]').hasText(`Reply rejected ${markup}`)
    assert.dom('[data-action="reply-conversation"]').doesNotExist('rejected choices cannot be reused')
    assert.dom('[data-quest-id="a-closer-look"]').hasAttribute('data-quest-status', 'completed')
    assert.dom('[role="alert"]').doesNotExist()
  })

  test('paused dialogue stays readable while idle journal reads remain available and stale choices disappear', async function(this: RenderingTestContext, assert) {
    let finishJournal!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client } = provideConversationClient({ conversation: { status: 'ready', targetId: 'synthetic/workshop-guide.json',
      speaker: 'Guide', text: 'Bring the pebble.', message: 'Choose a reply.', options: [{ id: 'show', text: 'Here it is.' }] },
    refresh() { calls.push('journal'); return new Promise<unknown>(resolve => { finishJournal = resolve }) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, moving: false, status: 'completed', message: 'Paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-option-id="show"]')!.disabled)
    assert.dom('[data-conversation-text]').hasText('Bring the pebble.')
    assert.dom('[data-action="begin-conversation"]').isDisabled()
    assert.dom('[data-option-id="show"]').isDisabled()
    assert.dom('[data-action="refresh-journal"]').isNotDisabled()
    await click('[data-action="refresh-journal"]')
    assert.deepEqual(calls, ['journal'])
    assert.dom('[data-journal-status]').hasText('Refreshing journal…')
    assert.dom('[data-action="refresh-journal"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    client.events.emit('Player:ConversationUpdated', { status: 'stale', message: 'World changed; talk again.' })
    client.events.emit('Player:JournalUpdated', { status: 'ready', message: 'Journal ready.', entries: [] })
    finishJournal()
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="refresh-journal"]')!.disabled)
    assert.dom('[data-action="reply-conversation"]').doesNotExist()
    assert.dom('[data-conversation-status]').hasText('World changed; talk again.')
    assert.dom('[data-action="toggle-pause"]').isNotDisabled()
  })

  test('journal rejection preserves verified entries and needs no known actor inventory', async function(this: RenderingTestContext, assert) {
    const message = 'Journal unavailable <img src=x onerror=alert(1)>'
    const calls: unknown[] = []
    provideConversationClient({ known: false, journal: { status: 'ready', message: 'Journal ready.',
      entries: [{ id: 'a-closer-look', title: 'A closer look', status: 'active', text: 'Find the pebble.' }] },
    refresh: async () => { calls.push('journal'); throw new Error(message) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-action="refresh-journal"]').isNotDisabled()
    await click('[data-action="refresh-journal"]')
    assert.deepEqual(calls, ['journal'])
    assert.dom('[data-journal-status]').hasText(message)
    assert.dom('[data-journal-status] img').doesNotExist()
    assert.dom('[data-quest-id="a-closer-look"]').hasAttribute('data-quest-status', 'active')
    assert.dom('[data-action="refresh-journal"]').isNotDisabled()
  })

  test('conversation teardown discards late private events and completion', async function(this: RenderingTestContext, assert) {
    let finish!: (value?: unknown) => void
    const { client, listeners } = provideConversationClient({ begin: () => new Promise<unknown>(resolve => { finish = resolve }) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="begin-conversation"]')
    await clearRender()
    for (const name of ['World:ConversationTargetsUpdated', 'Player:ConversationUpdated', 'Player:JournalUpdated']) {
      assert.strictEqual(listeners.get(name)!.size, 0)
    }
    client.events.emit('Player:ConversationUpdated', { status: 'ready', text: 'Late dialogue', options: [{ id: 'accept', text: 'Late choice' }] })
    client.events.emit('Player:JournalUpdated', { status: 'ready', entries: [{ title: 'Late quest' }] })
    finish()
    assert.dom('[data-conversation-panel], [data-journal-panel]').doesNotExist()
  })

  test('runtime failure removes conversation and journal listeners as the map stops', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = provideConversationClient()
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Dialogue server disconnected'))
    await waitUntil(() => !this.element.querySelector('[data-conversation-panel]'))
    for (const name of ['World:ConversationTargetsUpdated', 'Player:ConversationUpdated', 'Player:JournalUpdated']) {
      assert.strictEqual(listeners.get(name)!.size, 0)
    }
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })

  function provideCharacterClient({ refresh = async () => {}, supported = true, known = true,
    state = { experiencePoints: 0, level: 1, unspentPoints: 5, nextLevelExperience: 2100 } }: { refresh?: ArgsAction; supported?: boolean; known?: boolean; state?: Partial<FixtureCharacter> } = {}) {
    const fixture = provideConversationClient({ known })
    fixture.client.characterState = { status: supported ? 'ready' : 'unavailable', supported, ...state,
      message: supported ? 'Character loaded.' : 'Character progression is unavailable for this actor.' }
    fixture.client.refreshCharacter = (...args) => refresh(fixture.client, args)
    return fixture
  }

  test('Character renders private server values and refreshes without inferring quest XP or spending points', async function(this: RenderingTestContext, assert) {
    let finish!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client } = provideCharacterClient({ refresh(replica, args) {
      calls.push(args)
      return new Promise<unknown>(resolve => { finish = () => {
        replica.events.emit('Player:CharacterUpdated', { status: 'ready', supported: true, experiencePoints: 2100,
          level: 2, unspentPoints: 6, nextLevelExperience: 4600, message: 'Character loaded.' })
        resolve(undefined)
      } })
    } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.deepEqual(calls, [], 'the component renders startup state without issuing another private read')
    assert.dom('[data-inventory-panel] [data-character-panel]').exists('Character shares the existing left scroll card')
    assert.dom('[data-interaction-stack] [data-character-panel]').doesNotExist()
    assert.dom('[data-character-experience]').hasText('0')
    assert.dom('[data-character-level]').hasText('1')
    assert.dom('[data-character-points]').hasText('5')
    assert.dom('[data-character-next-level]').hasText('2100')
    assert.dom('[data-character-panel]').includesText('Spending character points is in development.')
    assert.dom('[data-action="spend-character-point"]').doesNotExist()
    client.events.emit('Player:JournalUpdated', { status: 'ready', message: 'Journal loaded.',
      entries: [{ id: 'a-closer-look', title: 'A closer look', status: 'completed', text: 'You showed the pebble.' }] })
    assert.dom('[data-character-experience]').hasText('0', 'a journal completion cannot award XP in presentation')
    await click('[data-action="refresh-character"]')
    assert.deepEqual(calls, [[]], 'the read supplies no client-authored XP, level or point values')
    assert.dom('[data-character-status]').hasText('Refreshing character…')
    assert.dom('[data-character-values]').doesNotExist('pending reads never display speculative progress')
    assert.dom('[data-action="refresh-character"]').isDisabled()
    assert.dom('[data-action="refresh-journal"]').isDisabled()
    assert.dom('[data-action="begin-conversation"]').isDisabled()
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    finish()
    await waitUntil(() => this.element.querySelector('[data-character-experience]'))
    assert.dom('[data-character-experience]').hasText('2100')
    assert.dom('[data-character-level]').hasText('2')
    assert.dom('[data-character-points]').hasText('6')
    assert.dom('[data-character-next-level]').hasText('4600')
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    client.events.emit('Player:CharacterUpdated', { status: 'ready', supported: true, experiencePoints: 1300000,
      level: 50, unspentPoints: 7, nextLevelExperience: null, message: 'Character loaded.' })
    await waitUntil(() => this.element.querySelector('[data-character-level]')!.textContent! === '50')
    assert.dom('[data-character-experience]').hasText('1300000', 'presentation displays validated server values without calculating a level curve')
    assert.dom('[data-character-level]').hasText('50')
    assert.dom('[data-character-next-level]').hasText('Maximum level')
  })

  test('unsupported character progression never turns known inventory or omitted stats into default values', async function(this: RenderingTestContext, assert) {
    provideCharacterClient({ supported: false, state: { experiencePoints: 0, level: 1, unspentPoints: 5 } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-character-status]').hasText('Character progression is unavailable for this actor.')
    assert.dom('[data-character-status]').hasAttribute('data-character-status', 'unavailable')
    assert.dom('[data-character-values]').doesNotExist('supported:false hides even accidentally present numeric fields')
    assert.dom('[data-character-panel]').doesNotIncludeText('Banked character points')
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    assert.dom('[data-inventory-items]').includesText('Your inventory is empty.')
  })

  test('character reads work while paused with unknown inventory and wait for movement or checkpoint completion', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const { client } = provideCharacterClient({ known: false, refresh: async replica => {
      calls.push('character')
      replica.events.emit('Player:CharacterUpdated', { status: 'ready', supported: true, experiencePoints: 0,
        level: 1, unspentPoints: 5, nextLevelExperience: 2100, message: 'Character loaded.' })
    } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, moving: false, status: 'completed', message: 'Paused.' })
    await waitUntil(() => this.element.querySelector('[data-paused="true"]'))
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    await click('[data-action="refresh-character"]')
    assert.deepEqual(calls, ['character'])
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, moving: true, status: 'completed', message: 'Moving.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="refresh-character"]')!.disabled)
    assert.dom('[data-action="refresh-character"]').isDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, moving: false, status: 'completed', message: 'Running.' })
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Loading checkpoint…' })
    assert.dom('[data-action="refresh-character"]').isDisabled()
    client.events.emit('Player:CharacterUpdated', { status: 'stale', supported: true, message: 'Refresh character after loading.' })
    await waitUntil(() => !this.element.querySelector('[data-character-values]'))
    assert.dom('[data-character-values]').doesNotExist()
    client.events.emit('Player:CheckpointUpdated', { status: 'completed', message: 'Checkpoint loaded.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-action="refresh-character"]')!.disabled)
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
  })

  test('character rejection is escaped and recoverable without inventing progress', async function(this: RenderingTestContext, assert) {
    const message = 'Character read failed <img src=x onerror=alert(1)>'
    const { client } = provideCharacterClient({ refresh: async () => { throw new Error(message) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="refresh-character"]')
    assert.dom('[data-character-status]').hasText(message)
    assert.dom('[data-character-status]').hasAttribute('data-character-status', 'rejected')
    assert.dom('[data-character-status] img').doesNotExist()
    assert.dom('[data-character-values]').doesNotExist()
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    assert.dom('[role="alert"]').doesNotExist()
    client.events.emit('Player:CharacterUpdated', { status: 'ready', supported: true, experiencePoints: 0, level: 1,
      unspentPoints: 5, nextLevelExperience: 2100, message: 'Character loaded.' })
    await waitUntil(() => this.element.querySelector('[data-character-experience]'))
    assert.dom('[data-character-experience]').hasText('0')
    assert.dom('[data-character-points]').hasText('5')
  })

  test('character teardown removes its listener before late private values arrive', async function(this: RenderingTestContext, assert) {
    let finish!: (value?: unknown) => void
    const { client, listeners } = provideCharacterClient({ refresh: () => new Promise<unknown>(resolve => { finish = resolve }) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="refresh-character"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:CharacterUpdated')!.size, 0)
    client.events.emit('Player:CharacterUpdated', { status: 'ready', supported: true, experiencePoints: 2100, level: 2, unspentPoints: 6 })
    finish()
    assert.dom('[data-character-panel]').doesNotExist()
  })

  test('runtime failure removes the character subscription', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = provideCharacterClient()
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Character authority disconnected'))
    await waitUntil(() => !this.element.querySelector('[data-character-panel]'))
    assert.strictEqual(listeners.get('Player:CharacterUpdated')!.size, 0)
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })

  const baseAttributeIds = ['strength', 'dexterity', 'constitution', 'beauty', 'intelligence', 'perception', 'willpower', 'charisma']
  const attributeRows = () => baseAttributeIds.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1),
    value: 8, maximum: 20, pointCost: 1, canIncrease: true }))
  const derivedPreview = () => ({ maxHealth: 30, maxFatigue: 30, carryWeight: 4000, damageBonus: -1,
    armorClassAdjustment: -2, speed: 8, healRate: 3, poisonRecovery: 8, reactionModifier: -7, maxFollowers: 2 })
  function provideAttributeClient({ purchase = async () => {}, attributes = attributeRows(), unspentPoints = 5 }: { purchase?: ArgsAction; attributes?: FixtureAttribute[]; unspentPoints?: number } = {}) {
    const fixture = provideCharacterClient({ state: { experiencePoints: 0, level: 1, unspentPoints,
      nextLevelExperience: 2100, attributes, derived: derivedPreview() } })
    fixture.client.spendCharacterPoint = (...args) => purchase(fixture.client, args)
    return fixture
  }

  test('attribute purchase forwards only a server stat ID and waits for private balances, values and preview', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    let finish!: (value?: unknown) => void
    provideAttributeClient({ purchase(replica, args) {
      calls.push(args)
      return new Promise<unknown>(resolve => { finish = () => {
        replica.events.emit('Player:CharacterUpdated', { ...replica.characterState, status: 'ready', unspentPoints: 4,
          attributes: attributeRows().map(row => row.id === 'strength' ? { ...row, value: 9 } : row),
          derived: { ...derivedPreview(), maxHealth: 32 }, message: 'Attribute increased.' })
        resolve(undefined)
      } })
    } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-action="increase-attribute"]').exists({ count: 8 })
    assert.dom('[data-attribute-id="strength"] [data-attribute-value]').hasText('8')
    assert.dom('[data-character-points]').hasText('5')
    assert.dom('[data-stat-id="strength"]').hasAttribute('aria-label', 'Increase Strength')
    await click('[data-stat-id="strength"]')
    assert.deepEqual(calls, [['strength']], 'value, point cost and balance remain server-owned')
    assert.dom('[data-character-status]').hasText('Increasing attribute…')
    assert.dom('[data-character-values]').doesNotExist('the view never spends a point or raises a stat optimistically')
    assert.dom('[data-action="increase-attribute"]').doesNotExist('a pending purchase cannot be repeated')
    assert.dom('[data-action="refresh-character"]').isDisabled()
    assert.dom('[data-action="begin-conversation"]').isDisabled()
    assert.dom('[data-action="pickup-ground-item"]').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    finish()
    await waitUntil(() => this.element.querySelector('[data-attribute-value]'))
    assert.dom('[data-attribute-id="strength"] [data-attribute-value]').hasText('9')
    assert.dom('[data-attribute-id="dexterity"] [data-attribute-value]').hasText('8')
    assert.dom('[data-character-points]').hasText('4')
    assert.dom('[data-derived-stat="maxHealth"]').hasText('32')
    assert.dom('[data-action="increase-attribute"]').exists({ count: 8 })
  })

  test('attribute availability and escaped cap or point reasons come from the private server view', async function(this: RenderingTestContext, assert) {
    const reason = 'Not enough Character Points. <img src=x onerror=alert(1)>'
    provideAttributeClient({ unspentPoints: 0, attributes: attributeRows().map(row => row.id === 'strength'
      ? { ...row, value: 20, canIncrease: false, reason: 'Attribute is at its maximum.' }
      : { ...row, canIncrease: false, reason, label: `Dexterity <img src=x onerror=alert(1)>` }) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-stat-id="strength"]').isDisabled()
    assert.dom('[data-stat-id="dexterity"]').isDisabled()
    assert.dom('[data-attribute-id="strength"]').includesText('Attribute is at its maximum.')
    assert.dom('[data-attribute-id="dexterity"] [data-attribute-reason]').hasText(reason)
    assert.dom('[data-stat-id="dexterity"]').hasAttribute('aria-label', 'Increase Dexterity <img src=x onerror=alert(1)>')
    assert.dom('[data-character-attributes] img').doesNotExist()
    assert.dom('[data-character-points]').hasText('0')
    assert.dom('[data-action="respec-attributes"]').doesNotExist()
  })

  test('attribute purchases stop while paused but the folded preview and private refresh remain available', async function(this: RenderingTestContext, assert) {
    const { client } = provideAttributeClient()
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.false(this.element.querySelector<HTMLDetailsElement>('[data-character-derived]')!.open)
    assert.dom('[data-character-derived]').includesText('Carry capacity (stone)')
    assert.dom('[data-character-derived]').includesText('Effects on combat, movement and carried weight are in development.')
    assert.dom('[data-character-derived] [data-derived-stat]').exists({ count: 10 })
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, moving: false, status: 'completed', message: 'Paused.' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-stat-id="strength"]')!.disabled)
    assert.dom('[data-stat-id="strength"]').isDisabled()
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, moving: false, status: 'completed', message: 'Running.' })
    await waitUntil(() => !this.element.querySelector<HTMLButtonElement>('[data-stat-id="strength"]')!.disabled)
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Loading…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-stat-id="strength"]')!.disabled)
    assert.dom('[data-stat-id="strength"]').isDisabled()
  })

  test('attribute purchase rejection is escaped and never invents a point refund or stat change', async function(this: RenderingTestContext, assert) {
    const message = 'Attribute purchase rejected <img src=x onerror=alert(1)>'
    const { client } = provideAttributeClient({ purchase: async () => { throw new Error(message) } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-stat-id="strength"]')
    assert.dom('[data-character-status]').hasText(message)
    assert.dom('[data-character-status] img').doesNotExist()
    assert.dom('[data-character-values]').doesNotExist()
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
    client.events.emit('Player:CharacterUpdated', { ...client.characterState, status: 'ready', message: 'Character loaded.' })
    await waitUntil(() => this.element.querySelector('[data-character-points]'))
    assert.dom('[data-character-points]').hasText('5')
    assert.dom('[data-attribute-id="strength"] [data-attribute-value]').hasText('8')
    assert.dom('[role="alert"]').doesNotExist()
  })

  test('teardown discards late attribute purchase values and point balances', async function(this: RenderingTestContext, assert) {
    let finish!: (value?: unknown) => void
    const { client, listeners } = provideAttributeClient({ purchase: () => new Promise<unknown>(resolve => { finish = resolve }) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-stat-id="strength"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:CharacterUpdated')!.size, 0)
    client.events.emit('Player:CharacterUpdated', { ...client.characterState, status: 'ready', unspentPoints: 4,
      attributes: attributeRows().map(row => ({ ...row, value: 9 })) })
    finish()
    assert.dom('[data-character-panel]').doesNotExist()
  })

  test('an uncertain purchase keeps the verified recovery view when the client rejects the original acknowledgement', async function(this: RenderingTestContext, assert) {
    provideAttributeClient({ purchase: async replica => {
      replica.events.emit('Player:CharacterUpdated', { ...replica.characterState, status: 'ready', unspentPoints: 4,
        attributes: attributeRows().map(row => row.id === 'strength' ? { ...row, value: 9 } : row),
        derived: { ...derivedPreview(), maxHealth: 32 }, message: 'Character verified after an uncertain purchase.' })
      throw new Error('Original purchase acknowledgement timed out')
    } })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-stat-id="strength"]')
    assert.dom('[data-character-status]').hasAttribute('data-character-status', 'ready')
    assert.dom('[data-character-status]').hasText('Character verified after an uncertain purchase.')
    assert.dom('[data-character-points]').hasText('4')
    assert.dom('[data-attribute-id="strength"] [data-attribute-value]').hasText('9')
    assert.dom('[data-action="refresh-character"]').isNotDisabled()
  })

  function providePauseClient(action: (client: FixtureClient, paused: boolean) => unknown) {
    const fixture = provideContainerClient(async () => {})
    fixture.client.authorityState.pause = { supported: true, paused: false }
    fixture.client.setPaused = paused => action(fixture.client, paused)
    fixture.client.saveCheckpoint = async () => ({ kind: 'save', savedAt: '2026-10-12T12:00:00.000Z' })
    return fixture
  }

  test('pause controls wait for server state and permit an idle checkpoint while paused', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const calls: unknown[] = []
    const { client } = providePauseClient((replica, paused) => {
      calls.push(paused)
      return new Promise<unknown>(resolve => { complete = () => {
        replica.authorityState.pause!.paused = paused
        replica.events.emit('Player:PauseUpdated', { supported: true, paused, moving: false,
          status: 'completed', message: paused ? 'Local game paused.' : 'Local game running.' })
        resolve({ kind: paused ? 'pause' : 'resume', paused })
      } })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-pause-panel]').exists()
    assert.dom('[data-action="toggle-pause"]').hasText('Pause')
    assert.dom('[data-action="toggle-pause"]').hasAttribute('aria-pressed', 'false')
    await click('[data-action="toggle-pause"]')
    assert.deepEqual(calls, [true])
    assert.false(client.authorityState.pause!.paused, 'the button does not modify the server snapshot')
    assert.dom('[data-pause-status]').hasText('Pausing local game…')
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.dom('[data-action="toggle-pause"]').hasAttribute('aria-pressed', 'false')
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    complete()
    await waitUntil(() => this.element.querySelector('[data-pause-status]')!.textContent!.includes('Local game paused.'))
    assert.dom('[data-action="toggle-pause"]').hasText('Resume')
    assert.dom('[data-action="toggle-pause"]').hasAttribute('aria-pressed', 'true')
    assert.dom('[data-action="toggle-pause"]').isNotDisabled()
    assert.dom('[data-action="use-door"]').isDisabled()
    assert.dom('#door-target').isDisabled()
    assert.dom('[data-action="inspect-container"]').isDisabled()
    assert.dom('#container-target').isDisabled()
    assert.dom('[data-action="save-checkpoint"]').isNotDisabled()
    await click('[data-action="save-checkpoint"]')
    assert.dom('[data-checkpoint-status]').hasText('Checkpoint saved.')
    assert.dom('[data-action="toggle-pause"]').isNotDisabled()
    await click('[data-action="toggle-pause"]')
    assert.deepEqual(calls, [true, false])
    complete()
    await waitUntil(() => this.element.querySelector('[data-action="toggle-pause"]')!.textContent! === 'Pause')
    assert.dom('[data-action="use-door"]').isNotDisabled()
    assert.dom('[data-action="inspect-container"]').isNotDisabled()
  })

  test('pause and resume stay available during an approach without enabling conflicting checkpoints', async function(this: RenderingTestContext, assert) {
    const calls: unknown[] = []
    const { client } = providePauseClient(async (replica, paused) => {
      calls.push(paused)
      replica.events.emit('Player:PauseUpdated', { supported: true, paused, moving: true,
        status: 'completed', message: paused ? 'Local game paused.' : 'Local game running.' })
    })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Player:InteractionUpdated', { targetId: 'synthetic/door-a.json', status: 'approaching',
      message: 'Approaching door…' })
    await waitUntil(() => this.element.querySelector<HTMLButtonElement>('[data-action="use-door"]')!.disabled)
    assert.dom('[data-action="toggle-pause"]').isNotDisabled()
    await click('[data-action="toggle-pause"]')
    assert.dom('[data-action="toggle-pause"]').hasText('Resume')
    assert.dom('[data-action="toggle-pause"]').isNotDisabled('the approach must not trap the game in pause')
    assert.dom('[data-action="save-checkpoint"]').isDisabled()
    assert.dom('[data-action="load-checkpoint"]').isDisabled()
    assert.dom('[data-interaction-status]').hasText('Approaching door…')
    await click('[data-action="toggle-pause"]')
    assert.deepEqual(calls, [true, false])
    assert.dom('[data-action="toggle-pause"]').hasText('Pause')
    assert.dom('[data-action="use-door"]').isDisabled('the original approach remains pending after resume')
  })

  test('pause rejection is escaped and recoverable without changing paused presentation', async function(this: RenderingTestContext, assert) {
    const message = 'Pause unavailable. <img src=x onerror=alert(1)>'
    providePauseClient(async () => { throw new Error(message) })
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="toggle-pause"]')
    assert.dom('[data-pause-status]').hasText(message)
    assert.dom('[data-pause-status]').hasAttribute('data-pause-status', 'rejected')
    assert.dom('[data-pause-status] img').doesNotExist()
    assert.dom('[data-action="toggle-pause"]').hasAttribute('aria-pressed', 'false')
    assert.dom('[data-action="toggle-pause"]').isNotDisabled()
    assert.dom('[data-action="use-door"]').isNotDisabled()
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'running')
  })

  test('pause capability is explicit and pending checkpoints exclude pause actions', async function(this: RenderingTestContext, assert) {
    const { client } = providePauseClient(async () => assert.step('pause command'))
    client.authorityState.pause!.supported = false
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    assert.dom('[data-pause-panel]').doesNotExist()
    client.events.emit('Player:PauseUpdated', { supported: true, paused: false, status: 'idle', message: 'Local game running.' })
    client.events.emit('Player:CheckpointUpdated', { status: 'pending', message: 'Saving checkpoint…' })
    await waitUntil(() => this.element.querySelector('[data-action="toggle-pause"]'))
    assert.dom('[data-action="toggle-pause"]').isDisabled()
    assert.verifySteps([])
  })

  test('teardown removes pause listeners before late completion', async function(this: RenderingTestContext, assert) {
    let complete!: (value?: unknown) => void
    const { client, listeners } = providePauseClient(() => new Promise<unknown>(resolve => { complete = resolve }))
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    await click('[data-action="toggle-pause"]')
    await clearRender()
    assert.strictEqual(listeners.get('Player:PauseUpdated')!.size, 0)
    client.events.emit('Player:PauseUpdated', { supported: true, paused: true, status: 'completed', message: 'Late pause' })
    complete({ kind: 'pause', paused: true })
    assert.dom('[data-pause-panel]').doesNotExist()
  })

  test('runtime failure removes the pause listener as the map stops', async function(this: RenderingTestContext, assert) {
    const { client, listeners } = providePauseClient(async () => {})
    await render(hbs`<GameRender />`)
    await click('[data-action="start-game"]')
    client.events.emit('Game:Error', new Error('Server connection lost'))
    await waitUntil(() => !this.element.querySelector('[data-pause-panel]'))
    assert.strictEqual(listeners.get('Player:PauseUpdated')!.size, 0)
    assert.dom('[data-runtime-state]').hasAttribute('data-runtime-state', 'error')
  })
})
