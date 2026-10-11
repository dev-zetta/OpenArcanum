'use strict'

const { setTimeout: delay } = require('node:timers/promises')

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
  let movement
  try {
    movement = await contents.executeJavaScript(`(async () => {
      const client = globalThis.AGate._engine.client;
      const accepted = await client.movePlayerTo([94, 99]);
      const after = client.getDevelopmentState();
      const rejected = [];
      for (const target of [[94, 103], [90, 100], [64, 64]]) {
        try {
          await client.movePlayerTo(target);
          rejected.push({ target, rejected: false });
        } catch (error) {
          rejected.push({ target, rejected: true, message: error.message });
        }
      }
      return { accepted, after, rejected, final: client.getDevelopmentState() };
    })()`)
  } catch (error) {
    return { ...(await readState(contents)), initial, error: `Movement check failed: ${error.message}` }
  }
  const path = movement.accepted.path
  if (!Array.isArray(path) || JSON.stringify(path[0]) !== JSON.stringify(initial.player.location) ||
      JSON.stringify(path[path.length - 1]) !== '[94,99]' ||
      JSON.stringify(movement.after.player.location) !== '[94,99]' ||
      JSON.stringify(movement.after.player.spritePosition) === JSON.stringify(initial.player.spritePosition) ||
      movement.rejected.some(result => !result.rejected) ||
      JSON.stringify(movement.final.player.location) !== '[94,99]') {
    return { ...(await readState(contents)), initial, movement, error: 'Player movement or blocked/void target checks failed.' }
  }
  const input = { tested: testInput, target: [93, 99] }
  if (testInput) {
    const point = await contents.executeJavaScript(`(() => {
      const client = globalThis.AGate._engine.client;
      const tile = client.map.getTile(93, 99);
      const bounds = tile.sprite.iso.getBounds();
      const canvas = document.querySelector('#render2d');
      const rect = canvas.getBoundingClientRect();
      const screen = client.scene.pixi.screen;
      const hit = client.scene.pixi.renderer.events.rootBoundary.hitTest(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
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
  return { ...state, guiImages, initial, movement, input, elapsedMs: Date.now() - started }
}

module.exports = { runGameSmoke }
