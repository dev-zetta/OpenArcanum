import type {WebContents} from 'electron'
'use strict'

const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

const TARGET = 'Bates Mansion Lev 2/Sector/1/1/Portal/02B406F7-4EB4-1542-AEF6-F60EC04B6DDE.json'

// Main supplies an isolated temporary checkpoint path for automated sessions.
// This exercises the real renderer, headless host, disk persistence and observer
// without changing a user's normal checkpoint or copying private assets.
async function runCheckpointSmoke(contents, { testInput = false, timeout = 45000 } = {}) {
  const started = Date.now()
  // Renderer evaluation results are the dynamic payload returned by Electron's API.
  const report: Record<string, Awaited<ReturnType<WebContents['executeJavaScript']>>> = { ok: false, targetId: TARGET, nativeInput: testInput }
  let observer
  const snapshots = []

  function check(condition, message) { if (!condition) throw new Error(message) }

  async function evaluate(source) {
    let timer
    try {
      return await Promise.race([contents.executeJavaScript(source), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Checkpoint verification exceeded its time limit')),
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
          serverTime: state.authority.serverTime, actor: state.authority.actor,
          checkpoint: state.authority.checkpoint },
        door: state.authority.doors?.find(door => door.id === ${JSON.stringify(TARGET)}) || null,
        render: sprite ? { frame: sprite.frame, frames: sprite.totalFrames,
          frameKey: sprite.frameKey,
          textureSize: [sprite.iso.texture.frame.width, sprite.iso.texture.frame.height] } : null,
        blocked: client.map.isTileBlocked(98, 97) };
    })()`)
  }

  async function matchObserver(state) {
    const deadline = Math.min(started + timeout, Date.now() + 5000)
    while (Date.now() < deadline) {
      const snapshot = snapshots.find(snapshot => snapshot.revision === state.authority.revision)
      if (snapshot) {
        const actor = snapshot.actors.find(actor => actor.id === state.authority.actor.id)
        const door = snapshot.doors?.find(door => door.id === TARGET)
        check(snapshot.version === 1 && snapshot.mapId === 'Bates Mansion Lev 2' &&
          snapshot.serverTime === state.authority.serverTime &&
          JSON.stringify(actor) === JSON.stringify(state.authority.actor) &&
          JSON.stringify(door) === JSON.stringify(state.door) &&
          JSON.stringify(snapshot.checkpoint) === JSON.stringify(state.authority.checkpoint),
        'The observer and renderer disagree about the restored checkpoint')
        return { revision: snapshot.revision, serverTime: snapshot.serverTime, actor, door,
          checkpoint: snapshot.checkpoint }
      }
      await delay(30)
    }
    throw new Error('The observer missed the committed checkpoint snapshot')
  }

  function verifyScene(state, location, open) {
    check(state.ready && state.running && !state.error, 'The scene stopped during checkpoint verification')
    check(JSON.stringify(state.player.location) === JSON.stringify(location),
      'Checkpoint actor location did not match the saved authoritative position')
    check(state.door?.open === open && state.door.usable && !state.door.locked,
      'Checkpoint door state did not match the saved state')
    check(state.render?.frame === (open ? 6 : 0) && state.render.frames === 7,
      'Checkpoint restoration did not update the original door artwork')
    check(JSON.stringify(state.render.textureSize) === (open ? '[11,101]' : '[34,95]'),
      'Checkpoint restoration selected the wrong original door texture')
    check(state.blocked === !open, 'Checkpoint restoration did not update door collision')
  }

  function verifyCommit(record, kind) {
    const result = record.result
    const command = record.state.authority.actor.lastCommand
    const checkpoint = record.state.authority.checkpoint
    check(result?.kind === kind && Number.isSafeInteger(result.commandId) &&
      typeof result.savedAt === 'string' && Number.isFinite(Date.parse(result.savedAt)) &&
      command?.id === result.commandId && command.type === kind && command.status === 'completed' &&
      command.result?.kind === kind && command.result.savedAt === result.savedAt &&
      checkpoint?.supported && !checkpoint.busy && checkpoint.lastAction === kind &&
      checkpoint.savedAt === result.savedAt && !checkpoint.error,
    'Checkpoint completion did not match the authoritative command and status')
  }

  const move = target => evaluate(`globalThis.AGate._engine.client.movePlayerTo(${JSON.stringify(target)})`)
  const use = () => evaluate(`globalThis.AGate._engine.client.useTarget(${JSON.stringify(TARGET)})`)
  const save = () => evaluate('globalThis.AGate._engine.client.saveCheckpoint()')
  const load = () => evaluate('globalThis.AGate._engine.client.loadCheckpoint()')

  async function saveWithButton() {
    const previous = await read()
    let point
    while (Date.now() - started < timeout) {
      point = await evaluate(`(() => {
        const button = document.querySelector('[data-action="save-checkpoint"]');
        if (!button || button.disabled) return null;
        const rect = button.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2), y = Math.round(rect.top + rect.height / 2);
        if (!rect.width || !rect.height || document.elementFromPoint(x, y) !== button) return null;
        return { x, y };
      })()`)
      if (point) break
      await delay(30)
    }
    check(point, 'The Save checkpoint button was not available for native input')
    report.saveButton = point
    contents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: point.x, y: point.y })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: point.x, y: point.y })
    while (Date.now() - started < timeout) {
      const state = await read()
      check(!state.error, state.error || 'The scene failed during checkpoint button input')
      const command = state.authority.actor.lastCommand
      if (command?.type === 'save' && command.status === 'completed' &&
          command.id > (previous.authority.actor.lastCommand?.id || 0)) {
        const status = await evaluate(`document.querySelector('[data-checkpoint-status]')?.getAttribute('data-checkpoint-status')`)
        if (status === 'completed') return { commandId: command.id, ...command.result }
      }
      await delay(30)
    }
    throw new Error('Native Save checkpoint input did not complete and update its status')
  }

  try {
    report.initial = await read()
    verifyScene(report.initial, [93, 99], false)
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, {
      auth: { version: 1, token: session.observerToken },
      transports: ['websocket'], autoConnect: false, reconnection: false, forceNew: true, timeout: 5000
    })
    observer.on('authority:snapshot', snapshot => {
      snapshots.push(snapshot)
      if (snapshots.length > 1500) snapshots.shift()
    })
    await new Promise<void>((resolve, reject) => {
      const connected = () => { observer.off('connect_error', failed); resolve() }
      const failed = error => { observer.off('connect', connected); reject(error) }
      observer.once('connect', connected)
      observer.once('connect_error', failed)
      observer.connect()
    })
    const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 1 })
    check(joined?.ok && joined.role === 'observer' && joined.version === 1 && joined.mapId === 'Bates Mansion Lev 2',
      'The checkpoint observer did not join the same local map')
    snapshots.push(joined.snapshot)

    await move([97, 97])
    await use()
    report.saved = { result: await save(), state: await read() }
    verifyCommit(report.saved, 'save')
    verifyScene(report.saved.state, [97, 97], true)
    report.saved.observer = await matchObserver(report.saved.state)

    await use()
    await move([93, 99])
    report.changed = await read()
    verifyScene(report.changed, [93, 99], false)

    report.loaded = { result: await load(), state: await read() }
    verifyCommit(report.loaded, 'load')
    check(report.loaded.result.commandId > report.saved.result.commandId &&
      report.loaded.result.savedAt === report.saved.result.savedAt,
      'Loading did not return a new completed authoritative checkpoint command')
    verifyScene(report.loaded.state, [97, 97], true)
    check(report.loaded.state.authority.revision > report.changed.authority.revision,
      'Loading reused an old snapshot revision')
    report.loaded.observer = await matchObserver(report.loaded.state)

    // Leave both the scene and the isolated save at the same regression baseline.
    await use()
    await move([93, 99])
    report.baseline = { result: await (testInput ? saveWithButton() : save()), state: await read() }
    verifyCommit(report.baseline, 'save')
    verifyScene(report.baseline.state, [93, 99], false)
    report.baseline.observer = await matchObserver(report.baseline.state)
    check(report.baseline.result.kind === 'save' &&
      report.baseline.result.commandId > report.loaded.result.commandId,
    'Restoring the baseline reset command replay protection')
    report.ok = true
  } catch (error) { report.error = `Checkpoint check failed: ${error.message}` }
  finally {
    observer?.removeAllListeners()
    observer?.disconnect()
  }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runCheckpointSmoke }
