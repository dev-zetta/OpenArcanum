import type {WebContents} from 'electron'
'use strict'

const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')

async function readState(contents) {
  return contents.executeJavaScript(`(() => {
    const root = document.querySelector('[data-runtime-state]');
    const alert = document.querySelector('[role="alert"]');
    const canvas = document.querySelector('#render2d');
    const client = globalThis.AGate?._engine?.client;
    const game = client?.getDevelopmentState?.() || null;
    return {
      status: root?.getAttribute('data-runtime-state') || null,
      error: alert?.textContent?.trim() || game?.error || null,
      game,
      canvas: canvas ? { width: canvas.width, height: canvas.height, hidden: canvas.hidden } : null,
      location: window.location.href
    };
  })()`)
}

async function runGameSmoke(contents, { timeout = 119000, testInput = false } = {}) {
  const started = Date.now()
  const clicked = await contents.executeJavaScript(`(() => {
    const button = document.querySelector('[data-action="start-game"]') ||
      Array.from(document.querySelectorAll('button')).find(button => /Start development runtime/.test(button.textContent));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`, true)
  if (!clicked) return { error: 'The game start button is unavailable. Compatible local assets are required.', ...(await readState(contents)) }
  let state
  while (Date.now() - started < timeout) {
    state = await readState(contents)
    if (state.error) return state
    if (state.status === 'running') break
    await delay(200)
  }
  if (state?.status !== 'running') return { ...state, error: 'Timed out waiting for the local game scene to start.' }
  if (!state.game) return { ...state, error: 'The running scene did not expose its development state.' }
  if (!state.game.ready || !state.game.running || !state.game.map || !state.game.sectors ||
      !state.game.renderedTiles || !state.game.prototypes || !state.game.player?.rendered) {
    return { ...state, error: 'The local map, textures and controlled actor are not ready.' }
  }
  const authority = state.game.authority
  if (authority?.mode !== 'local-server' || authority.protocolVersion !== 2 || !authority.connected ||
      !Number.isInteger(authority.serverPid) || authority.serverPid <= 0 ||
      !Number.isInteger(authority.revision) || !Number.isFinite(authority.serverTime) ||
      authority.actor?.id !== state.game.player.id ||
      JSON.stringify(authority.actor.location) !== JSON.stringify(state.game.player.location)) {
    return { ...state, error: 'The rendered actor is not connected to its local authoritative server.' }
  }
  if (state.game.renderedTiles !== state.game.tiles) {
    return { ...state, error: 'Typed converted ground artwork was omitted from the scene.' }
  }
  if (state.game.renderedRoofs !== state.game.roofs) {
    return { ...state, error: 'Recovered roof artwork was omitted from the scene.' }
  }
  if (state.game.lightingAvailable && (!state.game.lighting || state.game.lighting.skipped ||
      state.game.lighting.rendered !== state.game.lights)) {
    return { ...state, error: 'Recovered static light masks were not all installed.' }
  }
  if (!state.canvas || state.canvas.hidden || !state.canvas.width || !state.canvas.height) {
    return { ...state, error: 'The game canvas is not visible with a valid size.' }
  }
  const guiImages = await contents.executeJavaScript(`(async () => {
    const backgrounds = new Set();
    for (const element of document.querySelectorAll('#gui .gui-widget')) {
      const value = getComputedStyle(element).backgroundImage;
      if (value.startsWith('url(')) backgrounds.add(value.slice(4, -1).replace(/^["']|["']$/g, ''));
    }
    const samples = Array.from(backgrounds).slice(0, 12);
    const decoded = await Promise.all(samples.map(async source => {
      const image = new Image();
      image.src = source;
      try { await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }
      catch { return { error: 'A converted GUI background could not be decoded.' }; }
    }));
    return { backgroundCount: backgrounds.size, decoded };
  })()`)
  if (!guiImages.decoded.length || guiImages.decoded.some(image => image.error || !image.width || !image.height)) {
    return { ...state, guiImages, error: 'The authored GUI did not provide decodable background artwork.' }
  }
  state.guiImages = guiImages
  const initial = state.game
  let roofs: Awaited<ReturnType<WebContents['executeJavaScript']>> = {tested: false}
  if (initial.roofs && initial.map.id === 'Bates Mansion Lev 2') {
    roofs = await contents.executeJavaScript(`(() => {
      const client = globalThis.AGate._engine.client;
      const layer = client.scene.roofLayer;
      const interior = client.getDevelopmentState().visibleRoofs;
      // Original SEC West edge: original(111,92), runtime(92,111), subX3.
      // This is a visibility witness, not a claim that the tile is walkable.
      layer.updateVisibility({ x: 92, y: 111 });
      const exteriorEdge = client.getDevelopmentState().visibleRoofs;
      layer.updateVisibility(client.player.base.location);
      return { tested: true, interior, exteriorEdge, restored: client.getDevelopmentState().visibleRoofs };
    })()`)
    if (roofs.interior !== 0 || roofs.exteriorEdge !== initial.roofs || roofs.restored !== 0) {
      return { ...state, roofs, error: 'Recovered roof visibility did not follow the original interior/edge footprints.' }
    }
  }
  let movement
  try {
    movement = await contents.executeJavaScript(`(async () => {
      const client = globalThis.AGate._engine.client;
      const session = client.options.authoritySession;
      if (!session?.observerToken || session.protocolVersion !== 2) {
        throw new Error('The local session did not provide observer access.');
      }
      const socketModule = window.requireNode('socket.io-client');
      const observer = socketModule.io(session.url, {
        auth: { version: 2, token: session.observerToken },
        transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true, timeout: 5000
      });
      const snapshots = [];
      observer.on('authority:snapshot', snapshot => snapshots.push(snapshot));
      const completedActor = snapshot => snapshot?.actors?.find(actor => actor.id === client.player.id);
      function observeCompletion(commandId, revision) {
        const matches = snapshot => snapshot.version === 2 && snapshot.mapId === client.map.id &&
          snapshot.revision === revision && completedActor(snapshot)?.lastCommand?.id === commandId &&
          completedActor(snapshot)?.lastCommand?.status === 'completed';
        const existing = snapshots.find(matches);
        if (existing) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { cleanup(); reject(new Error('Observer missed the completed movement snapshot.')); }, 5000);
          function cleanup() { clearTimeout(timer); observer.off('authority:snapshot', receive); }
          function receive(snapshot) { if (matches(snapshot)) { cleanup(); resolve(snapshot); } }
          observer.on('authority:snapshot', receive);
        });
      }
      try {
        await new Promise((resolve, reject) => {
          const connected = () => { observer.off('connect_error', failed); resolve(); };
          const failed = error => { observer.off('connect', connected); reject(error); };
          observer.once('connect', connected);
          observer.once('connect_error', failed);
          observer.connect();
        });
        const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 2 });
        if (!joined.ok || joined.version !== 2 || joined.role !== 'observer' ||
            joined.mapId !== client.map.id || joined.actorId !== client.player.id ||
            JSON.stringify(completedActor(joined.snapshot)?.location) !== '[92,99]') {
          throw new Error('The second socket did not join the same authoritative world as an observer.');
        }
        let accepted, after, observed, paused;
        client.scene.stop();
        const framesBefore = client.scene.frameCount;
        try {
          accepted = await client.movePlayerTo([94, 99]);
          after = client.getDevelopmentState();
          observed = await observeCompletion(accepted.commandId, after.authority.revision);
          paused = { framesBefore, framesAfter: client.scene.frameCount,
            sceneStoppedAtCompletion: client.scene.stopped };
        } finally {
          if (!client.stopped) await client.scene.start();
        }
        const observedActor = completedActor(observed);
        const observerResult = { role: joined.role, protocolVersion: joined.version,
          joinedRevision: joined.snapshot.revision, completedRevision: observed.revision,
          serverTime: observed.serverTime, actor: observedActor,
          progressSnapshots: snapshots.filter(snapshot => completedActor(snapshot)?.movement?.commandId === accepted.commandId).length };
        const rejected = [];
        for (const target of [[94, 103], [90, 100], [64, 64]]) {
          try {
            await client.movePlayerTo(target);
            rejected.push({ target, rejected: false });
          } catch (error) {
            rejected.push({ target, rejected: true, message: error.message });
          }
        }
        return { accepted, after, paused, observer: observerResult, rejected, final: client.getDevelopmentState() };
      } finally {
        observer.removeAllListeners();
        observer.disconnect();
      }
    })()`)
  } catch (error) {
    return { ...(await readState(contents)), initial, error: `Movement check failed: ${error.message}` }
  }
  const path = movement.accepted.path
  if (!Array.isArray(path) || JSON.stringify(path[0]) !== JSON.stringify(initial.player.location) ||
      JSON.stringify(path[path.length - 1]) !== '[94,99]' ||
      JSON.stringify(movement.after.player.location) !== '[94,99]' ||
      JSON.stringify(movement.after.player.spritePosition) === JSON.stringify(initial.player.spritePosition) ||
      movement.paused.framesBefore !== movement.paused.framesAfter || !movement.paused.sceneStoppedAtCompletion ||
      movement.after.authority?.actor?.lastCommand?.id !== movement.accepted.commandId ||
      movement.after.authority.actor.lastCommand.status !== 'completed' || movement.after.authority.actor.movement !== null ||
      JSON.stringify(movement.after.authority.actor.location) !== '[94,99]' ||
      !movement.after.authority.actor.location.every(Number.isInteger) ||
      movement.observer.role !== 'observer' || movement.observer.protocolVersion !== 2 ||
      movement.observer.completedRevision !== movement.after.authority.revision ||
      movement.observer.serverTime !== movement.after.authority.serverTime || !movement.observer.progressSnapshots ||
      JSON.stringify(movement.observer.actor) !== JSON.stringify(movement.after.authority.actor) ||
      movement.rejected.some(result => !result.rejected) ||
      JSON.stringify(movement.final.player.location) !== '[94,99]') {
    return { ...(await readState(contents)), initial, movement, error: 'Player movement or blocked/void target checks failed.' }
  }
  const input: Awaited<ReturnType<WebContents['executeJavaScript']>> = {tested: testInput, target: [93, 99] }
  if (testInput) {
    const point = await contents.executeJavaScript(`(() => {
      const client = globalThis.AGate._engine.client;
      const tile = client.map.getTile(93, 99);
      const bounds = tile.sprite.iso.getBounds();
      const canvas = document.querySelector('#render2d');
      const rect = canvas.getBoundingClientRect();
      const screen = client.scene.pixi.screen;
      // Pixi initializes its native boundary's root on the first pointer event.
      // Use a stage-bound diagnostic without depending on prior mouse movement;
      // the native click below still exercises the actual EventSystem.
      const boundary = new client.scene.pixi.renderer.events.rootBoundary.constructor(client.scene.pixi.stage);
      const hit = boundary.hitTest(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return { x: Math.round(rect.left + (bounds.x + bounds.width / 2) * rect.width / screen.width),
        y: Math.round(rect.top + (bounds.y + bounds.height / 2) * rect.height / screen.height),
        hit: hit ? { type: hit.data?.data?.type || hit.data?.data?.base?.type || null,
          id: hit.data?.data?.id || null, isTarget: hit === tile.sprite.iso } : null };
    })()`)
    input.point = point
    const coordinates = { x: point.x, y: point.y }
    contents.sendInputEvent({ type: 'mouseMove', ...coordinates })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...coordinates })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...coordinates })
    for (let i = 0; i < 60; i++) {
      await delay(100)
      state = await readState(contents)
      if (state.error || JSON.stringify(state.game.player.location) === '[93,99]') break
    }
    input.after = state.game.player
    if (state.error || JSON.stringify(input.after.location) !== '[93,99]') {
      return { ...state, initial, movement, input, error: state.error || 'Clicking a real floor tile did not move the actor.' }
    }
  }
  // Allow active frame updates and delayed asset work to surface genuine errors.
  for (let i = 0; i < 24; i++) {
    await delay(250)
    state = await readState(contents)
    if (state.error || state.status !== 'running' || !state.game?.running) return { ...state, initial, movement, input, error: state.error || 'The game stopped during its frame checks.' }
  }
  if (state.game.frameCount <= initial.frameCount) {
    return { ...state, initial, movement, input, error: 'The game did not advance any rendered frames.' }
  }
  const objectLighting = await contents.executeJavaScript(`(() => {
    const client = globalThis.AGate._engine.client;
    const layer = client.scene.lightLayer;
    if (!layer) return { tested: false };
    const sprite = client.player.visual.classes.current.sprite.iso;
    const entry = layer.sampledTargets.get(sprite);
    if (!entry) return { tested: true, sampledPlayer: false };
    const point = entry.getWorldPoint();
    const rgb = layer.sampleColor(point);
    const original = entry.originalTint;
    const expected = (Math.round(((original >> 16) & 255) * rgb[0] / 255) << 16) |
      (Math.round(((original >> 8) & 255) * rgb[1] / 255) << 8) |
      Math.round((original & 255) * rgb[2] / 255);
    return { tested: true, sampledPlayer: true, point, rgb, tint: sprite.tint, expected,
      floorFilter: (sprite.filters || []).includes(layer.filter), ...layer.diagnostics };
  })()`)
  if (objectLighting.tested && (!objectLighting.sampledPlayer || objectLighting.floorFilter ||
      objectLighting.tint !== objectLighting.expected || !objectLighting.sampledTargets ||
      !objectLighting.filteredTargets)) {
    return { ...state, initial, movement, input, objectLighting,
      error: 'The animated player did not retain ground-sampled object illumination.' }
  }
  return { ...state, guiImages, initial, roofs, movement, input, objectLighting, elapsedMs: Date.now() - started }
}

module.exports = { runGameSmoke }
