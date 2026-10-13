import type {WebContents} from 'electron'
'use strict'

const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

const TARGET = 'Bates Mansion Lev 2/Sector/1/1/Portal/02B406F7-4EB4-1542-AEF6-F60EC04B6DDE.json'

// Private converted artwork is required, but never copied into this fixture.
// The chosen single door has walkable ground and a nonblocking wall frame.
async function runDoorSmoke(contents, { testInput = false, timeout = 45000 } = {}) {
  const started = Date.now()
  // Renderer evaluation results are the dynamic payload returned by Electron's API.
  const report: Record<string, Awaited<ReturnType<WebContents['executeJavaScript']>>> = { ok: false, targetId: TARGET, nativeInput: testInput }
  let observer
  const snapshots = []
  async function evaluate(source) {
    let timer
    try {
      return await Promise.race([contents.executeJavaScript(source), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Door verification exceeded its time limit')),
          Math.max(1, started + timeout - Date.now()))
      })])
    } finally { clearTimeout(timer) }
  }

  async function read() {
    return evaluate(`(() => {
      const client = globalThis.AGate._engine.client;
      const state = client.getDevelopmentState();
      const entity = Array.from(client.world.entityManager.entities.values()).find(entity => entity.sourcePath === ${JSON.stringify(TARGET)});
      const sprite = entity?.visual?.classes.current.sprite;
      return { ready: state.ready, running: state.running, error: state.error,
        player: state.player, authority: { revision: state.authority.revision,
          serverTime: state.authority.serverTime, actor: state.authority.actor },
        door: state.authority.doors?.find(door => door.id === ${JSON.stringify(TARGET)}) || null,
        render: sprite ? { frame: sprite.frame, frames: sprite.totalFrames,
          frameKey: sprite.frameKey, path: sprite.path,
          textureSize: [sprite.iso.texture.frame.width, sprite.iso.texture.frame.height] } : null,
        blocked: client.map.isTileBlocked(98, 97) };
    })()`)
  }

  function check(condition, message) { if (!condition) throw new Error(message) }

  async function matchObserver(state, commandId) {
    const deadline = Math.min(started + timeout, Date.now() + 5000)
    while (Date.now() < deadline) {
      const snapshot = snapshots.find(snapshot => snapshot.revision === state.authority.revision)
      if (snapshot) {
        const actor = snapshot.actors.find(actor => actor.id === state.authority.actor.id)
        const door = snapshot.doors?.find(door => door.id === TARGET)
        check(snapshot.version === 1 && snapshot.mapId === 'Bates Mansion Lev 2' &&
          snapshot.serverTime === state.authority.serverTime &&
          JSON.stringify(actor) === JSON.stringify(state.authority.actor) &&
          JSON.stringify(door) === JSON.stringify(state.door), 'The observer and renderer disagree about the authoritative door interaction')
        check(actor.lastCommand?.id === commandId && actor.lastCommand.status === 'completed' &&
          actor.lastCommand.type === 'use' && actor.lastCommand.targetId === TARGET &&
          actor.lastCommand.result?.targetId === TARGET && actor.lastCommand.result.open === door.open,
        'The observed use command did not complete against the selected door')
        return { revision: snapshot.revision, serverTime: snapshot.serverTime, actor, door }
      }
      await delay(30)
    }
    throw new Error('The observer missed the completed door snapshot')
  }

  async function verifyUse(result, expectedOpen) {
    const state = await read()
    check(state.ready && state.running && !state.error, 'The scene stopped during the door interaction')
    check(state.door?.open === expectedOpen && state.door.locked === false && state.door.usable,
      'The authoritative door state did not match the requested interaction')
    check(state.render?.frame === (expectedOpen ? 6 : 0) && state.render.frames === 7,
      'The real door artwork did not display its original open/closed frame')
    check(JSON.stringify(state.render.textureSize) === (expectedOpen ? '[11,101]' : '[34,95]'),
      'The selected texture does not match the original ART door frame dimensions')
    check(state.blocked === !expectedOpen, 'Door collision did not follow its authoritative open state')
    const commandId = result?.commandId ?? state.authority.actor.lastCommand?.id
    const observed = await matchObserver(state, commandId)
    check(Math.abs(state.player.location[0] - 98) + Math.abs(state.player.location[1] - 97) <= 1,
      'The actor used the door without first approaching it')
    return { commandId, result: result?.result || state.authority.actor.lastCommand.result,
      path: result?.path || null, state, observer: observed }
  }

  const use = () => evaluate(`globalThis.AGate._engine.client.useTarget(${JSON.stringify(TARGET)})`)
  const move = target => evaluate(`globalThis.AGate._engine.client.movePlayerTo(${JSON.stringify(target)})`)

  try {
    const initial = report.initial = await read()
    check(initial.ready && initial.running && !initial.error && initial.door &&
      JSON.stringify(initial.door.location) === '[98,97]' && initial.door.kind === 'door' &&
      initial.door.open === false && initial.door.locked === false && initial.door.usable &&
      initial.door.closedFrame === 0 && initial.door.openFrame === 6 && initial.render?.frame === 0 && initial.blocked,
    'The original unlocked closed Bates door was not ready for verification')
    check(Math.max(Math.abs(initial.player.location[0] - 98), Math.abs(initial.player.location[1] - 97)) > 1,
      'Door approach verification requires a nonadjacent starting actor')
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, {
      auth: { version: 1, token: session.observerToken },
      transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true, timeout: 5000
    })
    observer.on('authority:snapshot', snapshot => { snapshots.push(snapshot); if (snapshots.length > 1500) snapshots.shift() })
    await new Promise<void>((resolve, reject) => {
      const connected = () => { observer.off('connect_error', failed); resolve() }
      const failed = error => { observer.off('connect', connected); reject(error) }
      observer.once('connect', connected)
      observer.once('connect_error', failed)
      observer.connect()
    })
    const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 1 })
    check(joined?.ok && joined.role === 'observer' && joined.version === 1 && joined.mapId === 'Bates Mansion Lev 2',
      'The door observer did not join the same local map')
    snapshots.push(joined.snapshot)

    if (testInput) {
      const point = report.point = await evaluate(`(() => {
        const client = globalThis.AGate._engine.client;
        const entity = Array.from(client.world.entityManager.entities.values()).find(entity => entity.sourcePath === ${JSON.stringify(TARGET)});
        const sprite = entity.visual.classes.current.sprite.iso;
        const texture = sprite.texture;
        const image = texture.source.resource;
        const pixels = document.createElement('canvas');
        pixels.width = image.width;
        pixels.height = image.height;
        const context = pixels.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const frame = texture.frame;
        const rgba = context.getImageData(frame.x, frame.y, frame.width, frame.height).data;
        const canvas = document.querySelector('#render2d');
        const rect = canvas.getBoundingClientRect();
        const screen = client.scene.pixi.screen;
        const boundary = new client.scene.pixi.renderer.events.rootBoundary.constructor(client.scene.pixi.stage);
        const centerX = Math.floor(frame.width / 2), centerY = Math.floor(frame.height / 2);
        // Search actual opaque ART pixels and confirm the topmost scene hit.
        // Anchor/flipping are applied by Pixi's transform, never guessed offsets.
        for (let radius = 0; radius < Math.max(frame.width, frame.height); radius++) {
          for (let y = Math.max(0, centerY - radius); y <= Math.min(frame.height - 1, centerY + radius); y++) {
            for (let x = Math.max(0, centerX - radius); x <= Math.min(frame.width - 1, centerX + radius); x++) {
              if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) !== radius) continue;
              if (rgba[(y * frame.width + x) * 4 + 3] < 240) continue;
              const local = { x: x + .5 + (texture.trim?.x || 0) - sprite.anchor.x * texture.orig.width,
                y: y + .5 + (texture.trim?.y || 0) - sprite.anchor.y * texture.orig.height };
              const global = sprite.toGlobal(local);
              if (boundary.hitTest(global.x, global.y) !== sprite) continue;
              const input = { x: Math.round(rect.left + global.x * rect.width / screen.width),
                y: Math.round(rect.top + global.y * rect.height / screen.height) };
              if (document.elementFromPoint(input.x, input.y) !== canvas) continue;
              return { ...input, artPixel: [x, y], alpha: rgba[(y * frame.width + x) * 4 + 3], hitIsDoor: true };
            }
          }
        }
        throw new Error('No visible opaque pixel resolves to the real door');
      })()`)
      contents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
      contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: point.x, y: point.y })
      contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: point.x, y: point.y })
      const previousId = initial.authority.actor.lastCommand?.id || 0
      let opened = false
      while (Date.now() - started < timeout) {
        const state = await read()
        check(!state.error, state.error || 'The scene failed during native door input')
        if (state.door?.open && state.authority.actor.lastCommand?.id > previousId &&
            state.authority.actor.lastCommand.type === 'use' && state.authority.actor.lastCommand.status === 'completed') {
          opened = true
          break
        }
        await delay(100)
      }
      check(opened, 'Native door input did not approach and open the selected door')
      report.opened = await verifyUse(null, true)
    } else report.opened = await verifyUse(await use(), true)
    check(JSON.stringify(report.opened.state.player.location) !== JSON.stringify(initial.player.location),
      'Opening the nonadjacent door did not move the authoritative actor')

    report.closed = await verifyUse(await use(), false)
    report.reopened = await verifyUse(await use(), true)
    report.entered = await move([98, 97])
    const occupied = await read()
    check(JSON.stringify(occupied.player.location) === '[98,97]' && occupied.door.open,
      'The actor could not traverse the opened door tile')
    const occupiedError = await evaluate(`(async () => {
      try {
        await globalThis.AGate._engine.client.useTarget(${JSON.stringify(TARGET)});
        return { rejected: false };
      } catch (error) { return { rejected: true, code: error.code || null, message: error.message }; }
    })()`)
    const rejected = await read()
    check(occupiedError.rejected && occupiedError.code === 'OCCUPIED' && rejected.door.open && rejected.render.frame === 6 &&
      JSON.stringify(rejected.player.location) === '[98,97]', 'Closing an occupied doorway changed its state or displaced the actor')
    report.occupiedClose = { ...occupiedError, door: rejected.door, location: rejected.player.location }

    await move([97, 97])
    report.restoredDoor = await verifyUse(await use(), false)
    await move([93, 99])
    report.final = await read()
    check(JSON.stringify(report.final.player.location) === '[93,99]' && !report.final.door.open &&
      report.final.render.frame === 0 && report.final.blocked && report.final.ready && report.final.running && !report.final.error,
    'The door smoke did not restore the closed door and original-side actor')
    report.ok = true
  } catch (error) { report.error = `Door interaction check failed: ${error.message}` }
  finally {
    observer?.removeAllListeners()
    observer?.disconnect()
  }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runDoorSmoke }
