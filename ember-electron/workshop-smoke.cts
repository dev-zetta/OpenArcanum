import type {WebContents} from 'electron'
'use strict'

const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')
const { TOKEN_LABEL, KEY_BOX_ID, KEY_ID, LOCKED_DOOR_ID, LOCKED_BOX_ID, PRIZE_ID, PRIZE_LABEL,
  GROUND_ITEM_ID, GROUND_ITEM_LABEL, NPC_ID, QUEST_ID, QUEST_TITLE,
  QUEST_EXPERIENCE_REWARD, BALLAST_BOX_ID, BALLAST_ID, BALLAST_LABEL, BALLAST_WEIGHT } = require('../examples/inventory-workshop/generate.cts')
const MAP = 'Inventory workshop'
const BOX = `${MAP}/Sector/0/0/Container/owned-workshop-box.json`
const TOKEN = `${MAP}/Sector/0/0/Generic/owned-workshop-token.json`
const DOOR = `${MAP}/Sector/0/0/Portal/owned-workshop-door.json`

// All content in this scenario is bundled, authored source and generated art.
// It deliberately exercises the same client/authority as the private Bates map.
async function runWorkshopSmoke(contents, { timeout = 60000, testInput = false } = {}) {
  const started = Date.now(), snapshots = []
  // Renderer evaluation results are the dynamic payload returned by Electron's API.
  const report: Record<string, Awaited<ReturnType<WebContents['executeJavaScript']>>> = { moduleId: 'inventory-workshop', ok: false, nativeInput: testInput }
  let observer
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  async function evaluate(source) {
    let timer
    try {
      return await Promise.race([contents.executeJavaScript(source), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Workshop verification exceeded its time limit')),
          Math.max(1, started + timeout - Date.now()))
      })])
    } finally { clearTimeout(timer) }
  }
  const read = () => evaluate(`(() => {
    const client = globalThis.AGate?._engine?.client;
    return { status: document.querySelector('[data-runtime-state]')?.getAttribute('data-runtime-state'),
      error: document.querySelector('[role="alert"]')?.textContent || null,
      game: client?.getDevelopmentState() || null,
      actorSource: client?.player?.sourcePath,
      actorInventory: client?.player?.critter?.inventory,
      legacyStats: client?.player?.critter?.stats ?? null,
      characterPending: !!client?.characterRequest,
      nextCommandId: client?.authority?.nextId,
      visibleCharacter: {
        experience: document.querySelector('[data-character-xp]')?.textContent,
        level: document.querySelector('[data-character-level]')?.textContent,
        points: document.querySelector('[data-character-points]')?.textContent,
        nextLevel: document.querySelector('[data-character-next-level]')?.textContent },
      visibleAttributes: Object.fromEntries([...document.querySelectorAll('[data-attribute-id]')].map(row =>
        [row.dataset.attributeId, Number(row.querySelector('[data-attribute-value]').textContent)])),
      visibleDerived: Object.fromEntries([...document.querySelectorAll('[data-derived-stat]')].map(row =>
        [row.dataset.derivedStat, Number(row.textContent)])),
      authoredGui: client?.options.authoredGui,
      guiWidgets: document.querySelectorAll('#gui .gui-widget').length,
      legacyStyles: !!document.querySelector('link[data-arcanum-gui-assets]'),
      takeAvailable: !!document.querySelector('[data-action="take-item"]:not(:disabled)'),
      takeAllAvailable: !!document.querySelector('[data-action="take-all-items"]:not(:disabled)'),
      putAvailable: !!document.querySelector('[data-action="put-item"]:not(:disabled)'),
      visibleInventory: [...document.querySelectorAll('[data-inventory-items] li')].map(item => item.textContent.trim()),
      visibleCarrying: {
        weight: document.querySelector('[data-carried-weight]')?.textContent,
        capacity: document.querySelector('[data-carry-capacity]')?.textContent,
        encumbrance: document.querySelector('[data-encumbrance]')?.textContent,
        text: document.querySelector('[data-carrying-state]')?.textContent },
      groundRendered: (client?.ready && client?.world ? client.authorityState?.groundItems || [] : []).map(item => {
        const entity = [...client.world.entityManager.entities.values()].find(entity => entity.sourcePath === item.id);
        return { id: item.id, location: [entity.base.location.x,entity.base.location.y],
          visible: !!(entity.visual?.classes?.current?.sprite?.iso.parent && entity.visual.classes.current.sprite.iso.visible) };
      }),
      visibleItems: [...document.querySelectorAll('[data-container-items] li')].map(item => item.textContent.trim()) };
  })()`)
  async function waitFor(predicate, message) {
    while (Date.now() - started < timeout) {
      const state = await read()
      check(!state.error && !state.game?.error, state.error || state.game?.error)
      if (predicate(state)) return state
      await delay(30)
    }
    throw new Error(message)
  }
  async function button(action, itemId = null, attribute = 'itemId') {
    const point = await evaluate(`(() => {
      const button = [...document.querySelectorAll('[data-action="${action}"]')].find(value =>
        ${JSON.stringify(itemId)} === null || value.dataset[${JSON.stringify(attribute)}] === ${JSON.stringify(itemId)});
      if (!button || button.disabled) return null;
      button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = button.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2), y = Math.round(rect.top + rect.height / 2);
      return rect.width && rect.height && document.elementFromPoint(x, y) === button ? { x, y } : null;
    })()`)
    check(point, `The ${action} control is unavailable for native input`)
    contents.sendInputEvent({ type: 'mouseMove', ...point })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    return point
  }
  const move = target => evaluate(`globalThis.AGate._engine.client.movePlayerTo(${JSON.stringify(target)})`)
  const use = target => evaluate(`globalThis.AGate._engine.client.useTarget(${JSON.stringify(target)})`)
  const select = (id, value) => evaluate(`(() => {
    const select = document.getElementById(${JSON.stringify(id)});
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  const rejectedUse = target => evaluate(`(async () => {
    try { await globalThis.AGate._engine.client.useTarget(${JSON.stringify(target)}); return { rejected: false }; }
    catch (error) { return { rejected: true, code: error.code }; }
  })()`)
  const toggle = async paused => {
    if (testInput) {
      const point = await button('toggle-pause')
      await waitFor(state => state.game?.authority.pause.paused === paused && state.game.pause?.status === 'completed',
        'Native pause control did not reach the committed workshop state')
      return point
    }
    return evaluate(`globalThis.AGate._engine.client.setPaused(${paused})`)
  }
  function privateBoundary(snapshot) {
    check(!JSON.stringify(snapshot).includes(TOKEN) && !JSON.stringify(snapshot).includes(TOKEN_LABEL) &&
      !JSON.stringify(snapshot).includes(KEY_ID) && !JSON.stringify(snapshot).includes(PRIZE_ID) &&
      !JSON.stringify(snapshot).includes(PRIZE_LABEL) &&
      !JSON.stringify(snapshot).includes(QUEST_ID) && !JSON.stringify(snapshot).includes(QUEST_TITLE) &&
      !/"(?:items|itemIds|inventory|parent|quantity|weight|capacity|encumbrance|carrying|keyId|keyID|keyUseSupported|journal|quests|options|conversationId|nodeId|character|experiencePoints|level|unspentPoints|nextLevelExperience|attributes|derived|history|statId|maxHealth|maxFatigue|strength|dexterity|constitution|beauty|intelligence|perception|willpower|charisma)"\s*:/.test(JSON.stringify(snapshot)),
      'Workshop observer received private inventory information')
  }
  async function matchObserver(state) {
    const deadline = Math.min(started + timeout, Date.now() + 4000)
    while (Date.now() < deadline) {
      const snapshot = snapshots.find(value => value.revision === state.game.authority.revision)
      if (snapshot) {
        privateBoundary(snapshot)
        check(JSON.stringify(snapshot.actors.find(actor => actor.id === '0')) === JSON.stringify(state.game.authority.actor),
          'Workshop owner and observer disagree')
        check(JSON.stringify(snapshot.doors) === JSON.stringify(state.game.authority.doors) &&
          JSON.stringify(snapshot.containers) === JSON.stringify(state.game.authority.containers) &&
          JSON.stringify(snapshot.groundItems) === JSON.stringify(state.game.authority.groundItems) &&
          JSON.stringify(snapshot.conversationTargets) === JSON.stringify(state.game.authority.conversationTargets),
        'Workshop owner and observer disagree about public door or container state')
        return { revision: snapshot.revision, contentsAbsent: true, publicTargetsAgree: true }
      }
      await delay(20)
    }
    throw new Error('Workshop observer missed the committed snapshot')
  }
  try {
    await evaluate(`(() => {
      const button = document.querySelector('[data-action="start-game"]');
      if (!button || button.disabled || !button.textContent.includes('workshop')) throw new Error('Owned workshop startup is unavailable');
      button.click();
    })()`)
    report.initial = await waitFor(state => state.status === 'running' && state.game?.ready, 'Owned workshop did not start')
    const initial = report.initial
    check(initial.game.map.id === MAP && initial.game.sectors === 1 && initial.game.tiles === 120 &&
      initial.game.renderedTiles === initial.game.tiles && initial.game.player.rendered &&
      initial.actorSource === '16086.json' && Array.isArray(initial.actorInventory) && initial.actorInventory.length === 0 &&
      initial.authoredGui === false && !initial.guiWidgets && !initial.legacyStyles &&
      JSON.stringify(initial.game.player.location) === '[4,4]' && initial.game.inventory?.known === true && initial.game.inventory.items.length === 0,
    'Workshop startup did not use its own spawn, explicit actor ownership, graphics and GUI mode')
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, { auth: { version: 1, token: session.observerToken },
      transports: ['websocket'], reconnection: false, autoConnect: false, forceNew: true, timeout: 5000 })
    observer.on('authority:snapshot', snapshot => snapshots.push(snapshot))
    await new Promise<void>((resolve, reject) => {
      observer.once('connect', resolve); observer.once('connect_error', reject); observer.connect()
    })
    const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 1 })
    check(joined?.ok && joined.role === 'observer', 'Workshop observer did not join')
    snapshots.push(joined.snapshot)

    let pointPurchases = 0
    const progression = (state, awarded = false) => {
      const character = state.game.character
      check(character?.status === 'ready' && character.supported === true &&
        character.experiencePoints === (awarded ? QUEST_EXPERIENCE_REWARD : 0) && character.level === (awarded ? 2 : 1) &&
        character.unspentPoints === (awarded ? 6 : 5) - pointPurchases && character.nextLevelExperience === (awarded ? 4600 : 2100),
      'The private character view has an incorrect quest reward, level or point balance')
      return waitFor(rendered => rendered.visibleCharacter.experience === String(awarded ? QUEST_EXPERIENCE_REWARD : 0) &&
        rendered.visibleCharacter.level === String(awarded ? 2 : 1) && rendered.visibleCharacter.points === String((awarded ? 6 : 5) - pointPurchases),
      'The Character panel does not display the committed private progression')
    }
    await progression(initial)
    if (testInput) {
      const nextId = initial.nextCommandId
      report.characterReadButton = await button('refresh-character')
      report.characterRead = await waitFor(state => state.nextCommandId > nextId && !state.characterPending && state.game.character?.status === 'ready',
        'Native Character refresh did not read the private progression')
    } else { await evaluate('globalThis.AGate._engine.client.refreshCharacter()'); report.characterRead = await read() }
    await progression(report.characterRead)

    // Keep weight validation independent of every existing quest/key scenario.
    // Loading this pristine save restores both the initial build and ownership.
    report.weight = { savedBaseline: await evaluate('globalThis.AGate._engine.client.saveCheckpoint()') }
    const carried = (weight, capacity) => waitFor(state => state.game.inventory?.status === 'ready' &&
      state.game.inventory.carrying?.supported === true && state.game.inventory.carrying.weight === weight &&
      state.game.inventory.carrying.capacity === capacity && Number(state.visibleCarrying.weight) === weight &&
      Number(state.visibleCarrying.capacity) === capacity,
    'The inventory panel did not show the committed private carrying state')
    const transferWeightItem = async (action, targetId, itemId, weight, capacity) => {
      await use(targetId)
      if (testInput) await button(action === 'take' ? 'take-item' : 'put-item', itemId)
      else await evaluate(`globalThis.AGate._engine.client.${action === 'take' ? 'takeItem' : 'putItem'}(${JSON.stringify(targetId)},${JSON.stringify(itemId)})`)
      return carried(weight, capacity)
    }
    report.weight.initial = await carried(0, BALLAST_WEIGHT)
    report.weight.exact = await transferWeightItem('take', BALLAST_BOX_ID, BALLAST_ID, BALLAST_WEIGHT, BALLAST_WEIGHT)
    check(report.weight.exact.game.inventory.items.length === 1 &&
      report.weight.exact.game.inventory.items[0].id === BALLAST_ID &&
      report.weight.exact.game.inventory.items[0].weight === BALLAST_WEIGHT &&
      report.weight.exact.game.inventory.items[0].canDrop === true &&
      report.weight.exact.game.inventory.carrying.encumbrance === 'severe',
    'Exact-capacity Take did not retain ballast identity, weight, Drop capability and severe encumbrance band')
    await use(BOX)
    const beforeWeightReject = await read()
    if (testInput) {
      report.weight.rejectedButton = await button('take-item', TOKEN)
      report.weight.nativeRejected = await waitFor(state => state.game.interaction?.status === 'rejected' &&
        state.game.inventory?.status === 'ready', 'Native Take did not report the overweight rejection')
      check(JSON.stringify(report.weight.nativeRejected.game.inventory.items) === JSON.stringify(beforeWeightReject.game.inventory.items) &&
        report.weight.nativeRejected.game.authority.revision === beforeWeightReject.game.authority.revision,
      'Rejected native Take changed item ownership or world revision')
      await use(BOX)
    }
    report.weight.rejection = await evaluate(`(async () => {
      const client = globalThis.AGate._engine.client;
      try { await client.takeItem(${JSON.stringify(BOX)},${JSON.stringify(TOKEN)}); return {rejected:false}; }
      catch(error) {return {rejected:true,code:error.code};}
    })()`)
    check(report.weight.rejection.rejected && report.weight.rejection.code === 'TOO_HEAVY',
      'A fresh one-stone Take above capacity did not reject with TOO_HEAVY')
    report.weight.afterRejected = await carried(BALLAST_WEIGHT, BALLAST_WEIGHT)
    await use(BOX)
    check((await read()).game.interaction.items.length === 1 && (await read()).game.interaction.items[0].id === TOKEN,
      'Overweight Take removed the token from its original container')
    if (testInput) await button('increase-attribute', 'strength', 'statId')
    else await evaluate('globalThis.AGate._engine.client.spendCharacterPoint("strength")')
    report.weight.stronger = await carried(BALLAST_WEIGHT, 4500)
    check(report.weight.stronger.game.character.attributes.find(row => row.id === 'strength').value === 9 &&
      report.weight.stronger.game.character.unspentPoints === 4,
    'Strength did not spend one point while increasing live carrying capacity')
    report.weight.accepted = await transferWeightItem('take', BOX, TOKEN, BALLAST_WEIGHT + 1, 4500)
    check(report.weight.accepted.game.inventory.items.some(item => item.id === TOKEN) &&
      report.weight.accepted.game.inventory.carrying.encumbrance === 'heavy',
    'Increasing Strength did not permit the previously rejected item')
    report.weight.put = await transferWeightItem('put', BALLAST_BOX_ID, BALLAST_ID, 1, 4500)
    report.weight.retaken = await transferWeightItem('take', BALLAST_BOX_ID, BALLAST_ID, BALLAST_WEIGHT + 1, 4500)
    if (testInput) await button('drop-item', BALLAST_ID)
    else await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(BALLAST_ID)})`)
    report.weight.dropped = await carried(1, 4500)
    await waitFor(state => state.game.ground?.status === 'completed' &&
      state.game.authority.groundItems.some(item => item.id === BALLAST_ID) &&
      state.groundRendered.some(item => item.id === BALLAST_ID && item.visible),
    'Dropping ballast did not release capacity and render the same floor item')
    if (testInput) { await select('ground-target', BALLAST_ID); await button('pickup-ground-item') }
    else await evaluate(`globalThis.AGate._engine.client.pickupGroundItem(${JSON.stringify(BALLAST_ID)})`)
    report.weight.pickedUp = await carried(BALLAST_WEIGHT + 1, 4500)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.weight.restored = await carried(0, BALLAST_WEIGHT)
    check(report.weight.restored.game.character.attributes.every(row => row.value === 8) &&
      report.weight.restored.game.character.unspentPoints === 5 && report.weight.restored.game.inventory.items.length === 0 &&
      report.weight.restored.game.authority.groundItems.length === 1 &&
      report.weight.restored.game.authority.groundItems[0].id === GROUND_ITEM_ID &&
      JSON.stringify(report.weight.restored.game.player.location) === '[4,4]',
    'Checkpoint did not restore the pristine capacity, build, ownership and floor baseline')
    await use(BALLAST_BOX_ID)
    const restoredBallast = await read()
    check(restoredBallast.game.interaction.items.length === 1 && restoredBallast.game.interaction.items[0].id === BALLAST_ID,
      'Checkpoint did not return ballast to its independent original crate')
    await use(BOX)
    const restoredToken = await read()
    check(restoredToken.game.interaction.items.length === 1 && restoredToken.game.interaction.items[0].id === TOKEN,
      'Checkpoint did not return the token to its original crate')
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.weight.baseline = await carried(0, BALLAST_WEIGHT)
    report.weight.baseline.observer = await matchObserver(report.weight.baseline)

    check(initial.game.authority.groundItems.length === 1 && initial.game.authority.groundItems[0].id === GROUND_ITEM_ID &&
      initial.game.authority.groundItems[0].label === GROUND_ITEM_LABEL && initial.groundRendered[0]?.visible,
    'The owned ground item was not rendered from the authoritative floor state')
    if (testInput) {
      await select('ground-target', GROUND_ITEM_ID)
      report.groundPickupButton = await button('pickup-ground-item')
      report.groundPicked = await waitFor(state => state.game.inventory?.items.length === 1 &&
        state.game.inventory.items[0].id === GROUND_ITEM_ID && state.game.ground?.status === 'completed' &&
        state.game.authority.groundItems.length === 0, 'Native ground pickup did not conserve private ownership')
    } else { await evaluate(`globalThis.AGate._engine.client.pickupGroundItem(${JSON.stringify(GROUND_ITEM_ID)})`); report.groundPicked = await read() }
    check(report.groundPicked.game.inventory.items[0].canDrop === true, 'Picked-up item lost its authored Drop capability')
    report.groundPicked.observer = await matchObserver(report.groundPicked)
    const heldSnapshot = snapshots.find(row => row.revision === report.groundPicked.game.authority.revision)
    check(!JSON.stringify(heldSnapshot).includes(GROUND_ITEM_ID) && !JSON.stringify(heldSnapshot).includes(GROUND_ITEM_LABEL),
      'Pickup left the newly held item in public completion state')
    if (testInput) {
      report.groundDropButton = await button('drop-item', GROUND_ITEM_ID)
      report.groundDropped = await waitFor(state => state.game.inventory?.items.length === 0 &&
        state.game.ground?.status === 'completed' && state.game.authority.groundItems.length === 1 && state.groundRendered[0]?.visible,
      'Native Drop did not place the same visible item at the actor')
    } else { await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(GROUND_ITEM_ID)})`); report.groundDropped = await read() }
    check(JSON.stringify(report.groundDropped.game.authority.groundItems[0].location) === JSON.stringify(report.groundDropped.game.player.location) &&
      JSON.stringify(report.groundDropped.groundRendered[0].location) === JSON.stringify(report.groundDropped.game.player.location),
    'Dropped artwork or public placement differs from the authoritative actor tile')
    report.groundSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await move([6,6])
    if (testInput) {
      report.groundArtPoint = await evaluate(`(() => {
        const client = globalThis.AGate._engine.client;
        const entity = [...client.world.entityManager.entities.values()].find(value => value.sourcePath === ${JSON.stringify(GROUND_ITEM_ID)});
        const sprite = entity.visual.classes.current.sprite.iso, bounds = sprite.getBounds();
        const canvas = document.querySelector('#render2d'), rect = canvas.getBoundingClientRect(), screen = client.scene.pixi.screen;
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        const boundary = new client.scene.pixi.renderer.events.rootBoundary.constructor(client.scene.pixi.stage);
        return { x: Math.round(rect.left + x * rect.width / screen.width), y: Math.round(rect.top + y * rect.height / screen.height),
          target: boundary.hitTest(x,y) === sprite };
      })()`)
      check(report.groundArtPoint.target, 'Dropped ground artwork is not independently clickable')
      const { x, y } = report.groundArtPoint
      contents.sendInputEvent({ type: 'mouseMove', x, y })
      contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x, y })
      contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x, y })
      await waitFor(state => state.game.inventory?.items.some(item => item.id === GROUND_ITEM_ID) &&
        state.game.ground?.status === 'completed' && state.game.authority.groundItems.length === 0,
      'Native artwork click did not approach and pick up the dropped item')
    } else await evaluate(`globalThis.AGate._engine.client.pickupGroundItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.groundRestored = await read()
    check(report.groundRestored.game.inventory.items.length === 0 && report.groundRestored.groundRendered[0]?.visible &&
      JSON.stringify(report.groundRestored.game.authority.groundItems[0]) === JSON.stringify(report.groundDropped.game.authority.groundItems[0]),
    'Checkpoint did not restore the same ground item at its dropped position without duplication')
    await evaluate(`globalThis.AGate._engine.client.pickupGroundItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    await use(BOX)
    if (testInput) {
      report.groundPutButton = await button('put-item', GROUND_ITEM_ID)
      report.groundPut = await waitFor(state => state.game.inventory?.items.length === 0 &&
        state.game.interaction?.inspected && state.game.interaction.items.some(item => item.id === GROUND_ITEM_ID && item.canDrop === true),
      'Native Put did not preserve the ground item in the container')
      report.groundRetakeButton = await button('take-item', GROUND_ITEM_ID)
      report.groundRetaken = await waitFor(state => state.game.inventory?.items.length === 1 &&
        state.game.inventory.items[0].id === GROUND_ITEM_ID && state.game.inventory.items[0].canDrop === true &&
        state.game.interaction?.inspected && state.game.interaction.items.length === 1 && state.game.interaction.items[0].id === TOKEN,
      'Native Take did not restore the same droppable item while preserving the token')
    } else {
      await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(BOX)},${JSON.stringify(GROUND_ITEM_ID)})`)
      await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(BOX)},${JSON.stringify(GROUND_ITEM_ID)})`)
    }
    report.groundHeldSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await move([4,7])
    await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.groundHeldRestored = await read()
    check(report.groundHeldRestored.game.inventory.items.length === 1 &&
      report.groundHeldRestored.game.inventory.items[0].id === GROUND_ITEM_ID &&
      report.groundHeldRestored.game.authority.groundItems.length === 0,
    'Held checkpoint duplicated or lost the same pebble after a container roundtrip')
    await move([4,7])
    await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    await move([4,4])
    report.groundBaseline = await read()
    check(report.groundBaseline.game.inventory.items.length === 0 && report.groundBaseline.groundRendered[0]?.visible &&
      JSON.stringify(report.groundBaseline.game.authority.groundItems[0].location) === '[4,7]',
    'Ground scenario failed to restore its initial floor placement and empty actor')
    report.inspected = { result: await use(BOX), state: await read() }
    const items = report.inspected.result.result?.items
    check(report.inspected.result.result?.kind === 'container' && items?.length === 1 &&
      items[0].id === TOKEN && items[0].label === TOKEN_LABEL && items[0].slot === 3 && items[0].type === 'Generic' && items[0].prototypeId === 900003 &&
      report.inspected.result.commandId > report.inspected.result.approachCommandId &&
      JSON.stringify(report.inspected.state.game.player.location) === '[5,4]',
    'Owned nonempty container did not complete a private, reciprocal inspection')
    report.inspected.observer = await matchObserver(report.inspected.state)
    if (testInput) {
      await evaluate(`(() => {
        const select = document.querySelector('#container-target');
        select.value = ${JSON.stringify(BOX)};
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()`)
      report.inspectButton = await button('inspect-container')
      report.nativeInspection = await waitFor(state => state.game.interaction?.inspected && state.visibleItems.length === 1 &&
        state.visibleItems.some(label => label.includes(TOKEN_LABEL)) &&
        state.game.authority.actor.lastCommand.id > report.inspected.result.commandId, 'Native workshop inspection did not display its named item')
    }
    await toggle(true)
    report.saved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await toggle(false)
    await move([4,4])
    await toggle(true)
    report.loaded = await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.restored = await read()
    check(report.restored.game.authority.pause.paused && JSON.stringify(report.restored.game.player.location) === '[5,4]' &&
      !report.restored.game.interaction?.inspected && report.loaded.savedAt === report.saved.savedAt,
    'Workshop checkpoint failed to restore position while retaining pause and clearing private contents')
    await toggle(false)
    report.doorOpen = await use(DOOR)
    check(report.doorOpen.result?.open === true, 'Owned door did not open')
    await move([9,4])
    report.doorClosed = await use(DOOR)
    check(report.doorClosed.result?.open === false, 'Owned door did not close after traversal')
    if (testInput) {
      report.floorPoint = await evaluate(`(() => {
        const client = globalThis.AGate._engine.client, tile = client.map.getTile(5,5);
        const bounds = tile.sprite.iso.getBounds();
        const canvas = document.querySelector('#render2d'), rect = canvas.getBoundingClientRect(), screen = client.scene.pixi.screen;
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        const boundary = new client.scene.pixi.renderer.events.rootBoundary.constructor(client.scene.pixi.stage);
        const hit = boundary.hitTest(x,y);
        return { x: Math.round(rect.left + x * rect.width / screen.width), y: Math.round(rect.top + y * rect.height / screen.height),
          target: hit === tile.sprite.iso };
      })()`)
      check(report.floorPoint.target, 'Owned floor tile is obscured at its native input point')
      const { x, y } = report.floorPoint
      contents.sendInputEvent({ type: 'mouseMove', x, y })
      contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x, y })
      contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x, y })
      await waitFor(state => JSON.stringify(state.game.player.location) === '[5,5]' && !state.game.player.moving,
        'Native floor input did not move through the owned module')
    }
    await move([4,4])
    report.emptySaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await use(BOX)
    if (testInput) {
      await waitFor(state => state.takeAvailable && state.game.interaction?.canTake, 'Take control did not appear after a fresh private inspection')
      report.takeButton = await button('take-item')
      report.taken = await waitFor(state => state.game.inventory?.items.length === 1 && state.game.interaction?.inspected &&
        state.game.interaction.items.length === 0 && state.visibleInventory.length === 1, 'Native Take did not commit private ownership')
    } else {
      report.takeResult = await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(BOX)},${JSON.stringify(TOKEN)})`)
      report.taken = await read()
    }
    check(report.taken.game.inventory.ownerId === '16086.json' && report.taken.game.inventory.items[0].id === TOKEN &&
      report.taken.game.inventory.items[0].label === TOKEN_LABEL &&
      report.taken.game.inventory.items[0].slot === 0 && report.taken.game.interaction.items.length === 0,
    'Take did not conserve the same item in its new owner')
    report.taken.observer = await matchObserver(report.taken)
    report.duplicate = await evaluate(`(async () => {
      const client = globalThis.AGate._engine.client;
      try { await client.authority.take(client.player.id, ${JSON.stringify(BOX)}, ${JSON.stringify(TOKEN)}, client.authorityState.revision); return { rejected: false }; }
      catch (error) { return { rejected: true, code: error.code }; }
    })()`)
    check(report.duplicate.rejected && report.duplicate.code === 'UNKNOWN_ITEM', 'Taking the same item twice was not rejected')
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.returned = await read()
    check(report.returned.game.inventory.known && report.returned.game.inventory.items.length === 0 &&
      !report.returned.game.interaction?.inspected && JSON.stringify(report.returned.game.player.location) === '[4,4]',
    'Loading the earlier checkpoint did not restore empty actor ownership')
    await use(BOX)
    report.recovered = await read()
    check(report.recovered.game.interaction.items.length === 1 && report.recovered.game.interaction.items[0].id === TOKEN &&
      report.recovered.game.interaction.items[0].slot === 3, 'Checkpoint did not restore the token to its original sparse container slot')
    await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(BOX)},${JSON.stringify(TOKEN)})`)
    report.ownedSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await move([4,4])
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.ownedRestored = await read()
    check(report.ownedRestored.game.inventory.items.length === 1 && report.ownedRestored.game.inventory.items[0].id === TOKEN &&
      JSON.stringify(report.ownedRestored.game.player.location) === '[5,4]', 'Owned checkpoint did not restore the same item and position')
    await use(BOX)
    check((await read()).game.interaction.items.length === 0, 'Checkpoint duplicated the taken token back into its container')
    report.ownedRestored.observer = await matchObserver(await read())
    if (testInput) {
      await waitFor(state => state.putAvailable && state.game.interaction?.canPut,
        'Put control did not appear for the freshly inspected container')
      report.putButton = await button('put-item')
      report.put = await waitFor(state => state.game.inventory?.known && state.game.inventory.items.length === 0 &&
        state.game.interaction?.inspected && state.game.interaction.items.length === 1 && state.visibleInventory.length === 0,
      'Native Put did not return the token to the container')
    } else {
      report.putResult = await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(BOX)},${JSON.stringify(TOKEN)})`)
      report.put = await read()
    }
    check(report.put.game.interaction.items[0].id === TOKEN && report.put.game.interaction.items[0].slot === 0 &&
      report.put.game.inventory.items.length === 0, 'Put failed to conserve the token at the lowest unused container slot')
    report.put.observer = await matchObserver(report.put)
    report.duplicatePut = await evaluate(`(async () => {
      const client = globalThis.AGate._engine.client;
      try { await client.authority.put(client.player.id, ${JSON.stringify(BOX)}, ${JSON.stringify(TOKEN)}, client.authorityState.revision); return { rejected: false }; }
      catch (error) { return { rejected: true, code: error.code }; }
    })()`)
    check(report.duplicatePut.rejected && report.duplicatePut.code === 'UNKNOWN_ITEM', 'Putting the same item twice was not rejected')
    report.putSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await use(BOX)
    if (testInput) {
      await waitFor(state => state.takeAllAvailable && state.game.interaction?.canTake, 'Returned token could not be taken through Take All')
      report.takeAllButton = await button('take-all-items')
      report.retaken = await waitFor(state => state.game.inventory?.items.length === 1 && state.game.interaction?.inspected &&
        state.game.interaction.items.length === 0 && state.game.authority.actor.lastCommand?.type === 'take-all',
      'Native Take All did not conserve the returned token')
    } else {
      report.takeAllResult = await evaluate(`globalThis.AGate._engine.client.takeAllItems(${JSON.stringify(BOX)})`)
      report.retaken = await read()
    }
    check(report.retaken.game.inventory.items[0].id === TOKEN && report.retaken.game.inventory.items[0].label === TOKEN_LABEL &&
      report.retaken.game.inventory.items[0].slot === 0,
      'Take All changed the item identity or actor slot')
    report.retaken.observer = await matchObserver(report.retaken)
    check(!report.retaken.takeAllAvailable, 'Take All stayed available for an empty container')
    report.emptyBatch = await evaluate(`(async () => {
      const client = globalThis.AGate._engine.client;
      try { await client.authority.takeAll(client.player.id, ${JSON.stringify(BOX)}, client.authorityState.revision); return { rejected: false }; }
      catch (error) { return { rejected: true, code: error.code }; }
    })()`)
    check(report.emptyBatch.rejected && report.emptyBatch.code === 'EMPTY_CONTAINER', 'An empty Take All did not reject')
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.putRestored = await read()
    check(report.putRestored.game.inventory.known && report.putRestored.game.inventory.items.length === 0 &&
      !report.putRestored.game.interaction?.inspected, 'Put checkpoint did not restore an empty private actor inventory')
    await use(BOX)
    report.putRestored.container = (await read()).game.interaction
    check(report.putRestored.container.items.length === 1 && report.putRestored.container.items[0].id === TOKEN &&
      report.putRestored.container.items[0].slot === 0, 'Put checkpoint restored duplicate contents or the wrong sparse slot')
    report.putRestored.observer = await matchObserver(await read())
    await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(BOX)},${JSON.stringify(TOKEN)})`)

    report.missingKey = await rejectedUse(LOCKED_DOOR_ID)
    check(report.missingKey.rejected && report.missingKey.code === 'LOCKED', 'A locked door opened without the matching key')
    const beforeLockedBox = (await read()).game.player.location
    report.missingContainerKey = await rejectedUse(LOCKED_BOX_ID)
    check(report.missingContainerKey.rejected && report.missingContainerKey.code === 'LOCKED' &&
      JSON.stringify((await read()).game.player.location) === JSON.stringify(beforeLockedBox),
    'A locked container approached or disclosed contents without the matching key')
    report.lockedFloor = await evaluate(`(async () => {
      try { await globalThis.AGate._engine.client.movePlayerTo([10,6]); return { rejected: false }; }
      catch (error) { return { rejected: true, code: error.code }; }
    })()`)
    check(report.lockedFloor.rejected && report.lockedFloor.code === 'BLOCKED', 'The closed locked door did not block movement')
    await use(KEY_BOX_ID)
    if (testInput) {
      await select('container-target', KEY_BOX_ID)
      const previousInspection = (await read()).game.authority.actor.lastCommand.id
      report.keyInspectButton = await button('inspect-container')
      await waitFor(state => state.game.interaction?.targetId === KEY_BOX_ID && state.game.interaction.inspected &&
        state.game.interaction.items.some(item => item.id === KEY_ID) && state.game.authority.actor.lastCommand.id > previousInspection,
      'Native key-crate inspection did not display its key')
      report.keyTakeButton = await button('take-item', KEY_ID)
      report.keyTaken = await waitFor(state => state.game.inventory?.items.some(item => item.id === KEY_ID) &&
        state.game.interaction?.inspected && state.game.interaction.items.length === 0, 'Native Take did not transfer the standalone key')
    } else {
      await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(KEY_BOX_ID)},${JSON.stringify(KEY_ID)})`)
      report.keyTaken = await read()
    }
    check(report.keyTaken.game.inventory.items.length === 2 && report.keyTaken.game.inventory.items.find(item => item.id === KEY_ID)?.type === 'Key',
      'Taking a key changed the existing token or produced an invalid key row')

    await use(LOCKED_BOX_ID)
    if (testInput) {
      await select('container-target', LOCKED_BOX_ID)
      const previousInspection = (await read()).game.authority.actor.lastCommand.id
      report.lockedBoxInspectButton = await button('inspect-container')
      await waitFor(state => state.game.interaction?.targetId === LOCKED_BOX_ID && state.game.interaction.inspected &&
        state.game.interaction.items.some(item => item.id === PRIZE_ID && item.label === PRIZE_LABEL) &&
        state.game.authority.actor.lastCommand.id > previousInspection,
      'Native locked-container inspection did not display its keepsake')
      report.prizeTakeButton = await button('take-item', PRIZE_ID)
      report.prizeTaken = await waitFor(state => state.game.inventory?.items.length === 3 &&
        state.game.inventory.items.some(item => item.id === PRIZE_ID) && state.game.interaction?.inspected &&
        state.game.interaction.items.length === 0, 'Native Take did not transfer the locked keepsake')
      report.prizePutButton = await button('put-item', PRIZE_ID)
      await waitFor(state => state.game.inventory?.items.length === 2 && state.game.interaction?.inspected &&
        state.game.interaction.items.some(item => item.id === PRIZE_ID && item.slot === 0),
      'Native Put did not return the keepsake to the locked container')
      report.prizeTakeAllButton = await button('take-all-items')
      report.prizeRetaken = await waitFor(state => state.game.inventory?.items.length === 3 &&
        state.game.inventory.items.some(item => item.id === PRIZE_ID) && state.game.interaction?.inspected &&
        state.game.interaction.items.length === 0 && state.game.authority.actor.lastCommand?.type === 'take-all',
      'Native Take All did not transfer the locked keepsake')
    } else {
      await evaluate(`globalThis.AGate._engine.client.takeItem(${JSON.stringify(LOCKED_BOX_ID)},${JSON.stringify(PRIZE_ID)})`)
      report.prizeTaken = await read()
      await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(LOCKED_BOX_ID)},${JSON.stringify(PRIZE_ID)})`)
      await evaluate(`globalThis.AGate._engine.client.takeAllItems(${JSON.stringify(LOCKED_BOX_ID)})`)
      report.prizeRetaken = await read()
    }
    check(report.prizeRetaken.game.authority.containers.find(row => row.id === LOCKED_BOX_ID)?.locked === true &&
      report.prizeRetaken.game.inventory.items.some(item => item.id === KEY_ID) &&
      report.prizeRetaken.game.inventory.items.find(item => item.id === PRIZE_ID)?.label === PRIZE_LABEL,
    'Locked-container transfers cleared its lock, consumed the key or changed the keepsake')
    report.prizeRetaken.observer = await matchObserver(report.prizeRetaken)
    report.prizeSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await use(LOCKED_BOX_ID)
    await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(LOCKED_BOX_ID)},${JSON.stringify(PRIZE_ID)})`)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.prizeRestored = await read()
    check(report.prizeRestored.game.inventory.items.length === 3 &&
      report.prizeRestored.game.inventory.items.some(item => item.id === PRIZE_ID) && !report.prizeRestored.game.interaction?.inspected,
    'Checkpoint did not restore the taken keepsake and clear the old inspection')
    await use(LOCKED_BOX_ID)
    check((await read()).game.interaction.items.length === 0, 'Checkpoint duplicated the keepsake into the locked container')
    await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(LOCKED_BOX_ID)},${JSON.stringify(PRIZE_ID)})`)
    report.prizeReturned = await read()
    check(report.prizeReturned.game.inventory.items.length === 2 &&
      report.prizeReturned.game.interaction.items.length === 1 && report.prizeReturned.game.interaction.items[0].id === PRIZE_ID &&
      report.prizeReturned.game.interaction.items[0].slot === 0, 'Keepsake was not returned once to its lowest free container slot')

    if (testInput) {
      await select('door-target', LOCKED_DOOR_ID)
      report.keyDoorButton = await button('use-door')
      report.keyOpened = await waitFor(state => state.game.interaction?.targetId === LOCKED_DOOR_ID &&
        state.game.interaction.status === 'completed' && state.game.authority.doors.find(door => door.id === LOCKED_DOOR_ID)?.open,
      'Native door use did not approach and open with the carried key')
    } else { await use(LOCKED_DOOR_ID); report.keyOpened = await read() }
    check(report.keyOpened.game.authority.doors.find(door => door.id === LOCKED_DOOR_ID)?.locked === true &&
      report.keyOpened.game.inventory.items.some(item => item.id === KEY_ID), 'Key use cleared the lock or consumed the key')
    report.keyOpened.observer = await matchObserver(report.keyOpened)
    await move([11,6])
    report.keyTraversed = await read()
    check(JSON.stringify(report.keyTraversed.game.player.location) === '[11,6]', 'The key-opened door did not permit traversal')
    await use(KEY_BOX_ID)
    if (testInput) {
      report.keyPutButton = await button('put-item', KEY_ID)
      report.keyReturned = await waitFor(state => state.game.inventory?.items.length === 1 &&
        state.game.interaction?.inspected && state.game.interaction.items.some(item => item.id === KEY_ID), 'Native Put did not return the key')
    } else {
      await evaluate(`globalThis.AGate._engine.client.putItem(${JSON.stringify(KEY_BOX_ID)},${JSON.stringify(KEY_ID)})`)
      report.keyReturned = await read()
    }
    check(report.keyReturned.game.inventory.items[0].id === TOKEN &&
      report.keyReturned.game.interaction.items.find(item => item.id === KEY_ID)?.slot === 0, 'Putting the key changed token ownership or lost the key')
    report.keySaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    report.containerKeyRequiredAgain = await rejectedUse(LOCKED_BOX_ID)
    check(report.containerKeyRequiredAgain.rejected && report.containerKeyRequiredAgain.code === 'LOCKED',
      'The locked container remained accessible after its key was put away')
    await use(LOCKED_DOOR_ID)
    report.keyClosedWithoutKey = await read()
    check(!report.keyClosedWithoutKey.game.authority.doors.find(door => door.id === LOCKED_DOOR_ID)?.open,
      'An open locked door could not be closed after the key was put away')
    report.keyRequiredAgain = await rejectedUse(LOCKED_DOOR_ID)
    check(report.keyRequiredAgain.rejected && report.keyRequiredAgain.code === 'LOCKED', 'The closed door opened after the key was put away')
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.keyRestored = await read()
    check(report.keyRestored.game.authority.doors.find(door => door.id === LOCKED_DOOR_ID)?.open === true &&
      report.keyRestored.game.authority.doors.find(door => door.id === LOCKED_DOOR_ID)?.locked === true &&
      report.keyRestored.game.inventory.items.length === 1 && report.keyRestored.game.inventory.items[0].id === TOKEN,
    'Checkpoint did not restore the open locked door while the key remained in its crate')
    await use(KEY_BOX_ID)
    report.keyRestored.container = (await read()).game.interaction
    check(report.keyRestored.container.items.length === 1 && report.keyRestored.container.items[0].id === KEY_ID,
      'Checkpoint duplicated or lost the nonconsumed key')
    await use(LOCKED_DOOR_ID)
    report.keyRestored.observer = await matchObserver(await read())
    // Finish at the spawn with one owned token. Automated sessions use a
    // temporary checkpoint slot that is discarded when Electron exits.
    await move([4,4])
    await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    report.baseline = await read()
    check(report.baseline.game.running && !report.baseline.game.authority.pause.paused &&
      report.baseline.game.frameCount > initial.game.frameCount &&
      report.baseline.game.inventory.items.length === 1 && report.baseline.game.inventory.items[0].id === TOKEN &&
      JSON.stringify(report.baseline.game.player.location) === '[4,4]', 'Workshop did not restore its running baseline')
    report.baseline.observer = await matchObserver(report.baseline)

    report.attributes = { purchases: [] }
    const purchase = async statId => {
      const before = await read(), value = before.game.character.attributes.find(row => row.id === statId).value
      if (testInput) await button('increase-attribute', statId, 'statId')
      else await evaluate(`globalThis.AGate._engine.client.spendCharacterPoint(${JSON.stringify(statId)})`)
      const state = await waitFor(state => state.game.character?.status === 'ready' &&
        state.game.character.attributes.find(row => row.id === statId).value === value + 1 &&
        state.game.character.unspentPoints === before.game.character.unspentPoints - 1 && state.visibleAttributes[statId] === value + 1,
      'Attribute purchase did not conserve a point and publish its private value')
      pointPurchases++
      check(state.legacyStats === null, 'Buying an attribute unexpectedly mutated legacy character stats')
      report.attributes.purchases.push({ statId, character: state.game.character })
      return state
    }
    report.attributes.first = await purchase('strength')
    check(report.attributes.first.game.character.derived.maxHealth === 32 &&
      report.attributes.first.game.character.derived.carryWeight === 4500 &&
      report.attributes.first.game.character.derived.damageBonus === 0, 'Strength preview lost original HP, weight or C-division behavior')
    report.attributes.firstSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    const remainingStart = ['dexterity', 'constitution', 'willpower', 'beauty']
    for (const id of remainingStart) await purchase(id)
    report.attributes.startSpent = await read()
    await progression(report.attributes.startSpent)
    check(report.attributes.startSpent.game.character.unspentPoints === 0 &&
      report.attributes.startSpent.game.character.attributes.every(row => row.canIncrease === false), 'Starting points were not exhausted')
    report.attributes.noPoints = await evaluate(`(async () => {
      const c=globalThis.AGate._engine.client;
      try {await c.authority.buyAttribute(c.player.id,'intelligence',c.authorityState.revision);return {rejected:false};}
      catch(error){return {rejected:true,code:error.code};}
    })()`)
    check(report.attributes.noPoints.rejected && report.attributes.noPoints.code === 'INSUFFICIENT_POINTS',
      'Server accepted an attribute purchase with no points')
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    pointPurchases = 1
    report.attributes.firstRestored = await read()
    await progression(report.attributes.firstRestored)
    check(report.attributes.firstRestored.game.character.attributes.find(row => row.id === 'strength').value === 9 &&
      report.attributes.firstRestored.game.character.attributes.filter(row => row.id !== 'strength').every(row => row.value === 8),
    'Checkpoint did not restore exactly the first purchase')
    for (const id of remainingStart) await purchase(id)

    // The same server owns private branching replies and persistent quest
    // status. Showing an item is a condition, not an inventory transfer.
    report.dialogue = {}
    const talk = async () => {
      if (testInput) {
        await select('conversation-target', NPC_ID)
        await button('begin-conversation')
        return waitFor(state => state.game.conversation?.status === 'ready' && state.game.conversation.targetId === NPC_ID,
          'Native Talk did not approach the guide and receive private replies')
      }
      await evaluate(`globalThis.AGate._engine.client.beginConversation(${JSON.stringify(NPC_ID)})`)
      return read()
    }
    const reply = async optionId => {
      if (testInput) {
        await button('reply-conversation', optionId, 'optionId')
        return waitFor(state => state.game.conversation?.status === (optionId === 'leave' ? 'closed' : 'ready') &&
          (optionId === 'leave' || state.game.conversation.nodeId === (optionId === 'accept' ? 'active' : 'completed')),
        'Native reply did not reach its committed conversation page')
      }
      await evaluate(`globalThis.AGate._engine.client.replyConversation(${JSON.stringify(optionId)})`)
      return read()
    }
    const quest = state => state.game.journal?.entries.find(entry => entry.id === QUEST_ID)
    const pickupPebble = async () => {
      if (testInput) {
        await select('ground-target', GROUND_ITEM_ID)
        await button('pickup-ground-item')
        return waitFor(state => state.game.ground?.status === 'completed' && state.game.inventory.items.some(item => item.id === GROUND_ITEM_ID),
          'Quest pickup did not move the pebble into private ownership')
      }
      await evaluate(`globalThis.AGate._engine.client.pickupGroundItem(${JSON.stringify(GROUND_ITEM_ID)})`)
      return read()
    }
    report.dialogue.offered = await talk()
    check(report.dialogue.offered.game.conversation.nodeId === 'offer' && !quest(report.dialogue.offered),
      'Talking alone accepted a quest')
    report.dialogue.declined = await reply('leave')
    check(!quest(report.dialogue.declined), 'Declining changed quest state')
    await progression(report.dialogue.declined)
    await talk()
    report.dialogue.accepted = await reply('accept')
    check(quest(report.dialogue.accepted)?.status === 'active' &&
      !report.dialogue.accepted.game.conversation.options.some(option => option.id === 'show'),
    'Quest acceptance or absent-item reply condition is wrong')
    await progression(report.dialogue.accepted)
    report.dialogue.accepted.observer = await matchObserver(report.dialogue.accepted)
    report.dialogue.activeSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    report.dialogue.picked = await pickupPebble()
    check(report.dialogue.picked.game.conversation.status !== 'ready', 'Pickup left stale dialogue options active')
    if (testInput) {
      const point = await evaluate(`(() => {
        const client = globalThis.AGate._engine.client;
        const entity = [...client.world.entityManager.entities.values()].find(entity => entity.sourcePath === ${JSON.stringify(NPC_ID)});
        const sprite = entity.visual.classes.current.sprite.iso;
        client.scene.setCameraLocation(entity.base.location);
        client.scene.pixi.renderer.render(client.scene.pixi.stage);
        const bounds = sprite.getBounds();
        const canvas = document.querySelector('#render2d').getBoundingClientRect(), screen = client.scene.pixi.screen;
        const boundary = new client.scene.pixi.renderer.events.rootBoundary.constructor(client.scene.pixi.stage);
        for (let y = Math.ceil(bounds.y); y < bounds.y + bounds.height; y += 3) {
          for (let x = Math.ceil(bounds.x); x < bounds.x + bounds.width; x += 3) {
            if (boundary.hitTest(x,y) === sprite) {
              const point = {x:Math.round(canvas.left+x*canvas.width/screen.width),y:Math.round(canvas.top+y*canvas.height/screen.height)};
              if (document.elementFromPoint(point.x,point.y)?.id === 'render2d') return point;
            }
          }
        }
        return null;
      })()`)
      check(point, 'The guide sprite has no native hit target')
      report.dialogue.spriteClick = point
      contents.sendInputEvent({ type: 'mouseMove', ...point })
      contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
      contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
      report.dialogue.withPebble = await waitFor(state => state.game.conversation?.status === 'ready' &&
        state.game.conversation.targetId === NPC_ID && state.game.conversation.options.some(option => option.id === 'show'),
      'Native guide artwork did not approach and offer the held-item reply')
    } else report.dialogue.withPebble = await talk()
    const itemsBefore = report.dialogue.withPebble.game.inventory.items
    report.dialogue.completed = await reply('show')
    check(quest(report.dialogue.completed)?.status === 'completed' &&
      JSON.stringify(report.dialogue.completed.game.inventory.items) === JSON.stringify(itemsBefore),
    'Showing the pebble did not complete exactly once without consuming or rewarding inventory')
    await progression(report.dialogue.completed, true)
    report.dialogue.completed.observer = await matchObserver(report.dialogue.completed)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.dialogue.activeRestored = await read()
    check(quest(report.dialogue.activeRestored)?.status === 'active' &&
      report.dialogue.activeRestored.game.inventory.items.length === 1 &&
      report.dialogue.activeRestored.game.authority.groundItems.some(item => item.id === GROUND_ITEM_ID) &&
      report.dialogue.activeRestored.game.conversation?.status !== 'ready', 'Load did not restore active quest and floor ownership together')
    await progression(report.dialogue.activeRestored)
    await pickupPebble()
    await talk()
    await reply('show')
    report.attributes.rewardSpent = await purchase('charisma')
    await progression(report.attributes.rewardSpent, true)
    check(report.attributes.rewardSpent.game.character.unspentPoints === 0 &&
      JSON.stringify(report.attributes.rewardSpent.game.character.derived) === JSON.stringify({
        maxHealth:35,maxFatigue:35,carryWeight:4500,damageBonus:0,armorClassAdjustment:-1,speed:9,
        healRate:3,poisonRecovery:9,reactionModifier:-3,maxFollowers:2}), 'Sixth purchase did not recompute the neutral derived preview')
    report.dialogue.completedSaved = await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    await move([4,7])
    await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    await evaluate('globalThis.AGate._engine.client.loadCheckpoint()')
    report.dialogue.completedRestored = await read()
    check(quest(report.dialogue.completedRestored)?.status === 'completed' &&
      report.dialogue.completedRestored.game.inventory.items.some(item => item.id === GROUND_ITEM_ID),
    'Completed quest and held pebble did not survive the same checkpoint')
    await progression(report.dialogue.completedRestored, true)
    await move([4,7])
    await evaluate(`globalThis.AGate._engine.client.dropItem(${JSON.stringify(GROUND_ITEM_ID)})`)
    report.dialogue.terminal = await talk()
    check(quest(report.dialogue.terminal)?.status === 'completed' &&
      report.dialogue.terminal.game.conversation.nodeId === 'completed' &&
      report.dialogue.terminal.game.conversation.options.length === 1 &&
      report.dialogue.terminal.game.conversation.options[0].id === 'leave',
    'Putting the pebble away reopened or repeated the completed quest')
    await progression(report.dialogue.terminal, true)
    await reply('leave')
    await move([4,4])
    await evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
    const journalPoint = await evaluate(`(() => {
      const details = document.querySelector('[data-journal-entries]'), summary = details?.querySelector('summary');
      if (!summary || details.open) return null;
      summary.scrollIntoView({block:'nearest'});
      const rect = summary.getBoundingClientRect();
      const point = {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+rect.height/2)};
      return document.elementFromPoint(point.x,point.y) === summary ? point : null;
    })()`)
    check(journalPoint, 'The quest journal expander is unavailable')
    if (testInput) {
      contents.sendInputEvent({ type: 'mouseMove', ...journalPoint })
      contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...journalPoint })
      contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...journalPoint })
    } else await evaluate('document.querySelector("[data-journal-entries]").open = true')
    report.dialogue.journalVisible = await evaluate(`new Promise(resolve => setTimeout(() => {
      const details = document.querySelector('[data-journal-entries]');
      resolve({open:details.open,text:details.textContent});
    },50))`)
    check(report.dialogue.journalVisible.open && report.dialogue.journalVisible.text.includes(QUEST_TITLE) &&
      report.dialogue.journalVisible.text.includes('completed'), 'The native journal did not show the completed quest')
    if (testInput) {
      const nextId = (await read()).nextCommandId
      report.characterRewardReadButton = await button('refresh-character')
      report.characterRewardRead = await waitFor(state => state.nextCommandId > nextId && !state.characterPending && state.game.character?.status === 'ready',
        'Native Character refresh did not preserve the completed quest reward')
      await progression(report.characterRewardRead, true)
    }
    report.progressionVisible = await evaluate(`(() => {
      const values = document.querySelector('[data-character-values]');
      values.scrollIntoView({block:'nearest'});
      const rect = values.getBoundingClientRect(), panel = document.querySelector('[data-inventory-panel]').getBoundingClientRect();
      const entry = [...document.querySelectorAll('[data-quest-id]')].find(row => row.dataset.questId === ${JSON.stringify(QUEST_ID)});
      entry.scrollIntoView({block:'nearest'});
      return {visible:rect.top >= panel.top && rect.bottom <= panel.bottom,text:values.textContent};
    })()`)
    check(report.progressionVisible.visible && report.progressionVisible.text.includes(String(QUEST_EXPERIENCE_REWARD)),
      'Committed progression is not readable within the Character scroll panel')
    const derivedPoint = await evaluate(`(() => {
      const details=document.querySelector('[data-character-derived]'),summary=details.querySelector('summary');
      summary.scrollIntoView({block:'nearest'});
      const r=summary.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};
    })()`)
    if (testInput) {
      contents.sendInputEvent({type:'mouseMove',...derivedPoint});
      contents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...derivedPoint});
      contents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...derivedPoint});
    } else await evaluate('document.querySelector("[data-character-derived]").open=true')
    report.attributes.derivedVisible = await evaluate(`new Promise(resolve=>setTimeout(()=>{
      const details=document.querySelector('[data-character-derived]'),values=details.querySelector('dl');
      values.scrollIntoView({block:'nearest'});const r=values.getBoundingClientRect(),p=document.querySelector('[data-inventory-panel]').getBoundingClientRect();
      resolve({open:details.open,visible:r.top>=p.top&&r.bottom<=p.bottom,text:values.textContent});
    },50))`)
    check(report.attributes.derivedVisible.open && report.attributes.derivedVisible.visible,
      'Neutral derived preview cannot be read within the Character scroll panel')
    report.baseline = await read()
    report.baseline.observer = await matchObserver(report.baseline)
    await progression(report.baseline, true)
    check(report.baseline.game.inventory.items.length === 1 && report.baseline.game.inventory.items[0].id === TOKEN &&
      report.baseline.game.authority.groundItems[0]?.id === GROUND_ITEM_ID && quest(report.baseline)?.status === 'completed',
    'Dialogue scenario did not restore workshop ownership baseline and terminal quest')
    for (const snapshot of snapshots) privateBoundary(snapshot)
    report.ok = true
  } catch (error) { report.error = `Workshop check failed: ${error.message}` }
  finally { observer?.removeAllListeners(); observer?.disconnect() }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runWorkshopSmoke }
