import type {WebContents} from 'electron'
'use strict'

const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')

const TARGET = 'Bates Mansion Lev 2/Sector/1/1/Container/E505FDA5-0E4E-11D4-8F1D-00E02920220C.json'
const LOCKED = 'Bates Mansion Lev 2/Sector/1/1/Container/E505FDAB-0E4E-11D4-8F1D-00E02920220C.json'

// Exercise the real recovered empty dresser without changing locks or inventing
// accessible loot. Rich item/ownership privacy is tested with owned socket fixtures.
async function runContainerSmoke(contents, { testInput = false, timeout = 90000 } = {}) {
  const started = Date.now()
  // Renderer evaluation results are the dynamic payload returned by Electron's API.
  const report: Record<string, Awaited<ReturnType<WebContents['executeJavaScript']>>> = { ok: false, targetId: TARGET, lockedId: LOCKED, nativeInput: testInput }
  const snapshots = []
  let observer
  const check = (condition, message) => { if (!condition) throw new Error(message) }

  async function evaluate(source) {
    let timer
    try {
      return await Promise.race([contents.executeJavaScript(source), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Container verification exceeded its time limit')),
          Math.max(1, started + timeout - Date.now()))
      })])
    } finally { clearTimeout(timer) }
  }

  const read = () => evaluate(`(() => {
    const client = globalThis.AGate._engine.client, state = client.getDevelopmentState();
    return { ready: state.ready, running: state.running, error: state.error, player: state.player,
      interaction: state.interaction, authority: { revision: state.authority.revision,
        serverTime: state.authority.serverTime, actor: state.authority.actor,
        containers: state.authority.containers } };
  })()`)

  function verifyPrivateBoundary(snapshot) {
    check(!/"(?:items|inventory|parent|quantity)"\s*:/.test(JSON.stringify(snapshot)),
      'An observer snapshot exposed container inventory data')
  }

  async function matchObserver(state) {
    const deadline = Math.min(started + timeout, Date.now() + 5000)
    while (Date.now() < deadline) {
      const snapshot = snapshots.find(snapshot => snapshot.revision === state.authority.revision)
      if (snapshot) {
        verifyPrivateBoundary(snapshot)
        check(JSON.stringify(snapshot.actors.find(actor => actor.id === '0')) === JSON.stringify(state.authority.actor) &&
          JSON.stringify(snapshot.containers) === JSON.stringify(state.authority.containers) &&
          snapshot.serverTime === state.authority.serverTime,
        'Owner and observer disagree about container approach completion')
        return { revision: snapshot.revision, actor: snapshot.actors.find(actor => actor.id === '0'),
          publicContainers: snapshot.containers.length, privateContentsAbsent: true }
      }
      await delay(30)
    }
    throw new Error('Observer missed the committed container inspection summary')
  }

  async function inspectWithButton() {
    await evaluate(`(() => {
      const select = document.querySelector('#container-target');
      if (!select) throw new Error('Container selector is missing');
      select.value = ${JSON.stringify(TARGET)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
    const previous = (await read()).authority.actor.lastCommand?.id || 0
    let point
    while (Date.now() - started < timeout) {
      point = await evaluate(`(() => {
        const button = document.querySelector('[data-action="inspect-container"]');
        if (!button || button.disabled) return null;
        const rect = button.getBoundingClientRect();
        const x = Math.round(rect.left + rect.width / 2), y = Math.round(rect.top + rect.height / 2);
        return rect.width && rect.height && document.elementFromPoint(x, y) === button ? { x, y } : null;
      })()`)
      if (point) break
      await delay(30)
    }
    check(point, 'The container Inspect button was unavailable for native input')
    report.inspectButton = point
    contents.sendInputEvent({ type: 'mouseMove', ...point })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    while (Date.now() - started < timeout) {
      const state = await read()
      check(!state.error, state.error || 'Scene stopped during native container input')
      if (state.authority.actor.lastCommand?.type === 'inspect' && state.authority.actor.lastCommand.id > previous &&
          state.interaction?.status === 'completed' && state.interaction.inspected === true) return state
      await delay(30)
    }
    throw new Error('Native container input did not finish a private inspection')
  }

  try {
    report.initial = await read()
    check(JSON.stringify(report.initial.player.location) === '[93,99]', 'Container regression requires the restored movement baseline')
    const target = report.initial.authority.containers?.find(container => container.id === TARGET)
    check(target?.usable && !target.locked, 'The original empty dresser is missing recovered ownership or access metadata')
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, { auth: { version: 2, token: session.observerToken },
      transports: ['websocket'], reconnection: false, autoConnect: false, forceNew: true, timeout: 5000 })
    observer.on('authority:snapshot', snapshot => {
      snapshots.push(snapshot)
      if (snapshots.length > 3000) snapshots.shift()
    })
    await new Promise<void>((resolve, reject) => {
      observer.once('connect', resolve)
      observer.once('connect_error', reject)
      observer.connect()
    })
    const joined = await observer.timeout(5000).emitWithAck('authority:join', { version: 2 })
    check(joined?.ok && joined.role === 'observer', 'Container observer did not join')
    snapshots.push(joined.snapshot)

    report.inspected = { result: await evaluate(`globalThis.AGate._engine.client.useTarget(${JSON.stringify(TARGET)})`),
      state: await read() }
    const inspection = report.inspected.result
    check(inspection.result?.kind === 'container' && inspection.result.targetId === TARGET &&
      Array.isArray(inspection.result.items) && inspection.result.items.length === 0 &&
      inspection.commandId > inspection.approachCommandId,
    'The recovered empty container did not complete a separate private inspection')
    check(JSON.stringify(report.inspected.state.player.location) === '[79,86]',
      'The authority did not approach the dresser through the original map')
    report.inspected.observer = await matchObserver(report.inspected.state)

    report.locked = await evaluate(`globalThis.AGate._engine.client.useTarget(${JSON.stringify(LOCKED)})
      .then(() => ({ accepted: true }), error => ({ accepted: false, code: error.code, message: error.message }))`)
    check(!report.locked.accepted && report.locked.code === 'LOCKED', 'The original locked chest allowed inspection')
    const rejected = await read()
    check(JSON.stringify(rejected.player.location) === '[79,86]' && !rejected.interaction?.items?.length &&
      rejected.interaction?.inspected !== true, 'Locked rejection moved the actor or retained prior contents')

    report.native = testInput ? await inspectWithButton() : null
    if (report.native) {
      check(report.native.interaction.items?.length === 0, 'Native inspection invented items in an empty dresser')
      report.native.observer = await matchObserver(report.native)
    }
    for (const snapshot of snapshots) verifyPrivateBoundary(snapshot)

    await evaluate('globalThis.AGate._engine.client.movePlayerTo([93,99])')
    report.baseline = await read()
    check(report.baseline.ready && report.baseline.running && !report.baseline.error &&
      JSON.stringify(report.baseline.player.location) === '[93,99]' && !report.baseline.interaction?.inspected,
    'Walking away did not restore the scene baseline and clear inspected contents')
    report.ok = true
  } catch (error) { report.error = `Container check failed: ${error.message}` }
  finally { observer?.removeAllListeners(); observer?.disconnect() }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runContainerSmoke }
