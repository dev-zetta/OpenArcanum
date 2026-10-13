'use strict'

const { setTimeout: delay } = require('node:timers/promises')
const { io } = require('socket.io-client')

// Exercise a real mid-tile pause through the normal owner and optional native
// button input. Main provides an isolated checkpoint for all smoke scenarios.
async function runPauseSmoke(contents, { testInput = false, timeout = 20000 } = {}) {
  const started = Date.now()
  const report = { ok: false, nativeInput: testInput }
  const snapshots = []
  let observer
  const check = (value, message) => { if (!value) throw new Error(message) }

  async function evaluate(source) {
    let timer
    try {
      return await Promise.race([contents.executeJavaScript(source), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Pause verification exceeded its time limit')),
          Math.max(1, started + timeout - Date.now()))
      })])
    } finally { clearTimeout(timer) }
  }

  const read = () => evaluate(`(() => {
    const client = globalThis.AGate._engine.client, state = client.getDevelopmentState();
    const sprite = client.player.visual.classes.current.sprite;
    return { ready: state.ready, running: state.running, error: state.error,
      player: state.player, worldPosition: [sprite.iso.isoX, sprite.iso.isoY],
      frame: sprite.frame, frames: state.frameCount, steps: client.world.stepCount,
      pause: state.pause, authority: { revision: state.authority.revision,
        pause: state.authority.pause, actor: state.authority.actor },
      move: client._pauseSmokeMove || null };
  })()`)

  async function waitFor(predicate, message) {
    while (Date.now() - started < timeout) {
      const state = await read()
      check(state.ready && state.running && !state.error, state.error || 'The scene stopped during pause verification')
      if (predicate(state)) return state
      await delay(20)
    }
    throw new Error(message)
  }

  async function matchObserver(state) {
    const deadline = Math.min(started + timeout, Date.now() + 4000)
    while (Date.now() < deadline) {
      const snapshot = snapshots.find(value => value.revision === state.authority.revision)
      if (snapshot) {
        check(JSON.stringify(snapshot.pause) === JSON.stringify(state.authority.pause) &&
          JSON.stringify(snapshot.actors.find(actor => actor.id === '0')) === JSON.stringify(state.authority.actor),
        'Owner and observer disagree about paused movement')
        return { revision: snapshot.revision, pause: snapshot.pause, actor: snapshot.actors.find(actor => actor.id === '0') }
      }
      await delay(20)
    }
    throw new Error('Observer missed the committed pause snapshot')
  }

  async function toggle(paused) {
    if (!testInput) return evaluate(`globalThis.AGate._engine.client.setPaused(${paused})`)
    const point = await evaluate(`(() => {
      const button = document.querySelector('[data-action="toggle-pause"]');
      if (!button || button.disabled || button.getAttribute('aria-pressed') !== ${JSON.stringify(String(!paused))}) return null;
      const rect = button.getBoundingClientRect();
      const x = Math.round(rect.left + rect.width / 2), y = Math.round(rect.top + rect.height / 2);
      return rect.width && rect.height && document.elementFromPoint(x, y) === button ? { x, y } : null;
    })()`)
    check(point, `Native ${paused ? 'Pause' : 'Resume'} button is unavailable`)
    report[paused ? 'pauseButton' : 'resumeButton'] = point
    contents.sendInputEvent({ type: 'mouseMove', ...point })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    return waitFor(state => state.authority.pause?.paused === paused && state.pause?.status === 'completed',
      'Native pause input did not confirm the committed server state')
  }

  try {
    report.initial = await read()
    check(JSON.stringify(report.initial.player.location) === '[93,99]' &&
      report.initial.authority.pause?.supported && !report.initial.authority.pause.paused,
    'Pause regression requires the running restored movement baseline')
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, { auth: { version: 1, token: session.observerToken },
      transports: ['websocket'], reconnection: false, autoConnect: false, forceNew: true, timeout: 5000 })
    observer.on('authority:snapshot', snapshot => snapshots.push(snapshot))
    await new Promise((resolve, reject) => {
      observer.once('connect', resolve)
      observer.once('connect_error', reject)
      observer.connect()
    })
    const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 1 })
    check(joined?.ok && joined.role === 'observer', 'Pause observer did not join')
    snapshots.push(joined.snapshot)

    await evaluate(`(() => {
      const client = globalThis.AGate._engine.client;
      client._pauseSmokeMove = { status: 'pending' };
      client.movePlayerTo([94,99]).then(result => { client._pauseSmokeMove = { status: 'completed', result }; },
        error => { client._pauseSmokeMove = { status: 'rejected', code: error.code, message: error.message }; });
    })()`)
    report.moving = await waitFor(state => state.authority.actor.movement?.elapsedMs >= 150 &&
      state.authority.actor.movement.elapsedMs < 800, 'Movement did not reach a mid-tile pause witness')
    const movementId = report.moving.authority.actor.movement.commandId
    await toggle(true)
    await delay(80)
    report.paused = await read()
    const movement = report.paused.authority.actor.movement
    check(report.paused.authority.pause.paused && movement?.commandId === movementId &&
      movement.elapsedMs > 0 && movement.elapsedMs < movement.durationMs && report.paused.move.status === 'pending' &&
      report.paused.authority.actor.lastCommand.id === movementId,
    'Pausing lost the original mid-tile movement command')
    const pathStart = movement.path[movement.index], pathEnd = movement.path[movement.index + 1]
    const fraction = movement.elapsedMs / movement.durationMs
    const expected = pathStart.map((value, index) => (value + (pathEnd[index] - value) * fraction) * 40)
    check(report.paused.worldPosition.every((value, index) => Math.abs(value - expected[index]) < 0.001),
      'The rendered actor did not freeze at its authoritative fractional position')
    report.paused.observer = await matchObserver(report.paused)
    await delay(1250)
    report.frozen = await read()
    check(JSON.stringify(report.frozen.authority) === JSON.stringify(report.paused.authority) &&
      JSON.stringify(report.frozen.player.spritePosition) === JSON.stringify(report.paused.player.spritePosition) &&
      JSON.stringify(report.frozen.worldPosition) === JSON.stringify(report.paused.worldPosition) &&
      report.frozen.frame === report.paused.frame && report.frozen.steps === report.paused.steps &&
      report.frozen.frames > report.paused.frames && report.frozen.move.status === 'pending',
    'Paused wall time advanced host movement, sprite position or animation instead of leaving rendering/UI active')
    report.blocked = await evaluate(`globalThis.AGate._engine.client.movePlayerTo([93,99])
      .then(() => ({ accepted: true }), error => ({ accepted: false, code: error.code }))`)
    check(!report.blocked.accepted && report.blocked.code === 'PAUSED', 'Paused gameplay input was not rejected')
    await toggle(false)
    report.resumed = await read()
    check(!report.resumed.authority.pause.paused && report.resumed.authority.actor.movement?.commandId === movementId &&
      report.resumed.authority.actor.movement.elapsedMs < movement.durationMs,
    'Resume consumed paused wall time or replaced the original command')
    report.completed = await waitFor(state => state.move?.status === 'completed', 'Resumed movement never completed')
    check(report.completed.move.result.commandId === movementId &&
      JSON.stringify(report.completed.player.location) === '[94,99]', 'Resume completed a different move or endpoint')

    await evaluate('globalThis.AGate._engine.client.movePlayerTo([93,99])')
    await evaluate('globalThis.AGate._engine.client.setPaused(true)')
    report.checkpoint = await evaluate(`(async () => {
      const client = globalThis.AGate._engine.client;
      const saved = await client.saveCheckpoint();
      const loaded = await client.loadCheckpoint();
      return { saved, loaded, paused: client.authorityState.pause.paused };
    })()`)
    check(report.checkpoint.paused && report.checkpoint.saved.kind === 'save' && report.checkpoint.loaded.kind === 'load',
      'Idle paused save/load resumed the host or failed')
    await toggle(false)
    report.baseline = await read()
    check(!report.baseline.authority.pause.paused && !report.baseline.authority.actor.movement &&
      JSON.stringify(report.baseline.player.location) === '[93,99]', 'Pause check did not restore the running baseline')
    report.ok = true
  } catch (error) { report.error = `Pause check failed: ${error.message}` }
  finally {
    observer?.removeAllListeners()
    observer?.disconnect()
    await evaluate('delete globalThis.AGate?._engine?.client?._pauseSmokeMove').catch(() => {})
  }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runPauseSmoke }
