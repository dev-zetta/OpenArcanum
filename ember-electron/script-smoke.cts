import type { WebContents } from 'electron'
import type { Socket } from 'socket.io-client'
'use strict'

const fs = require('node:fs') as typeof import('node:fs')
const { setTimeout: delay } = require('node:timers/promises') as typeof import('node:timers/promises')
const { io } = require('socket.io-client') as typeof import('socket.io-client')
const { SCRIPTED_DOOR_ID, NPC_ID } = require('../examples/inventory-workshop/generate.cts')
const ORIGINAL_GUARD = 'Bates Mansion Lev 2/Sector/1/1/Npc/83A4A3DE-E89C-4A33-9109-0D83E510A4CF.json'
// Original script 2894 also disables this unique guard on clear floor at (89,91).
// The primary guard shares(86,91) with a solid wall and scenery.
const ORIGINAL_COLLISION_GUARD = 'Bates Mansion Lev 2/Sector/1/1/Npc/ED042CD9-CD9C-4CED-8829-1EB7EB4532AB.json'

interface ScriptSmokeOptions { timeout?: number; testInput?: boolean; moduleId?: string; checkpointPath?: string }
// Electron's evaluation boundary returns live renderer diagnostics. The smoke
// never installs a gameplay RPC or adds a production UI control.
type RendererValue = Awaited<ReturnType<WebContents['executeJavaScript']>>

async function runScriptSmoke(contents: WebContents, { timeout = 119000, testInput = false, moduleId, checkpointPath }: ScriptSmokeOptions = {}) {
  const started = Date.now(), owned = moduleId === 'inventory-workshop'
  const npc = owned ? NPC_ID : ORIGINAL_GUARD
  const report: Record<string, RendererValue> = { ok: false, scenario: owned ? 'owned-script-door' : 'original-guard-heartbeat', nativeInput: testInput }
  let observer: Socket | undefined
  const snapshots: RendererValue[] = [], observerMessages: RendererValue[] = []
  const check = (condition: unknown, message: string): void => { if (!condition) throw new Error(message) }
  async function bounded<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Script verification exceeded its time limit')), Math.max(1, started + timeout - Date.now()))
      })])
    } finally { clearTimeout(timer) }
  }
  const evaluate = (source: string): Promise<RendererValue> => bounded(contents.executeJavaScript(source))
  let lastRead: RendererValue
  const read = async () => {
    const state = await evaluate(`(() => {
    const client = globalThis.AGate?._engine?.client;
    const game = client?.ready && client?.map ? client.getDevelopmentState() : null;
    const inspectTarget = id => {
      const entity = client?.ready && client?.map && client?.world &&
        [...client.world.entityManager.entities.values()].find(value => value.map === client.map && value.sourcePath === id);
      if (!entity) return null;
      const position = entity.base.location, x = position.x, y = position.y;
      const iso = entity.visual?.classes?.current?.sprite?.iso;
      const tile = client.map.getTile(x,y);
      const sector = client.map.getSector(Math.floor(x/64),Math.floor(y/64));
      const occupants = tile && sector ? Object.values(sector.getTileEntities(tile,['Wall','Portal','Npc','Pc','Scenery','Container'])).map(value => ({
        id:value.sourcePath, type:value.base.type, off:value.scriptOff ?? value.base.flags.has('Off'),
        noBlock:value.base.flags.has('NoBlock'), inventory:value.base.flags.has('Inventory'),
        destroyed:value.base.flags.has('Destroyed'), portalOpen:value.portalOpen ?? null
      })) : [];
      return { id:entity.sourcePath, location:[x,y], inheritedOff:entity.base.flags.has('Off'),
        off:entity.scriptOff ?? entity.base.flags.has('Off'), ownOff:Object.hasOwn(entity,'scriptOff'),
        blocked:client.map.isTileBlocked(x,y), blockedByLocation:client.map.isTileBlocked(position),
        floor:{exists:!!tile,type:tile?.type || null,blocked:!!tile?.blocked},occupants,
        rendered:!!iso?.parent,visible:!!iso?.visible,renderable:!!iso?.renderable,eventMode:iso?.eventMode || null };
    };
    return { status: document.querySelector('[data-runtime-state]')?.getAttribute('data-runtime-state'),
      error: document.querySelector('[role="alert"]')?.textContent || game?.error || null, game,
      scriptEpoch: client?.scriptEpoch, scriptText: document.querySelector('[data-script-message]')?.textContent?.trim() || null,
      nextCommandId: client?.authority?.nextId,
      target: inspectTarget(${JSON.stringify(npc)}),
      collisionTarget: ${owned ? 'null' : `inspectTarget(${JSON.stringify(ORIGINAL_COLLISION_GUARD)})`},
      door: game?.authority?.doors?.find(value => value.id === ${JSON.stringify(SCRIPTED_DOOR_ID)}) || null };
  })()`)
    lastRead = state
    return state
  }
  async function waitFor(predicate: (state: RendererValue) => boolean, message: string) {
    while (Date.now() - started < timeout) {
      const state = await read()
      check(!state.error, state.error)
      if (predicate(state)) return state
      await delay(40)
    }
    throw new Error(message)
  }
  async function button(action: string) {
    const point = await evaluate(`(() => {
      const button = document.querySelector('[data-action="${action}"]');
      if (!button || button.disabled) return null;
      button.scrollIntoView({block:'nearest',inline:'nearest'});
      const rect = button.getBoundingClientRect(), x = Math.round(rect.left+rect.width/2), y = Math.round(rect.top+rect.height/2);
      return rect.width && rect.height && document.elementFromPoint(x,y) === button ? {x,y} : null;
    })()`)
    check(point, `The ${action} control is unavailable for native script input`)
    contents.sendInputEvent({ type: 'mouseMove', ...point })
    contents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    contents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
    return point
  }
  async function action(kind: 'use' | 'save' | 'load') {
    const before = await read(), lastId = before.game.authority.actor.lastCommand?.id || 0
    if (testInput) {
      if (kind === 'use') await evaluate(`(() => {
        const select=document.getElementById('door-target');
        select.value=${JSON.stringify(SCRIPTED_DOOR_ID)}; select.dispatchEvent(new Event('change',{bubbles:true}));
      })()`)
      await button(kind === 'use' ? 'use-door' : kind === 'save' ? 'save-checkpoint' : 'load-checkpoint')
    } else await evaluate(`globalThis.AGate._engine.client.${kind === 'use' ? `useTarget(${JSON.stringify(SCRIPTED_DOOR_ID)})` : kind === 'save' ? 'saveCheckpoint()' : 'loadCheckpoint()'}`)
    return waitFor(state => state.game?.authority.actor.lastCommand?.id > lastId &&
      state.game.authority.actor.lastCommand.type === kind && state.game.authority.actor.lastCommand.status === 'completed' &&
      (kind === 'use' ? state.game.interaction?.status === 'completed' : state.game.authority.checkpoint.lastAction === kind && !state.game.authority.checkpoint.busy),
    `The ${kind} script smoke command did not complete`)
  }
  function saved() {
    check(checkpointPath && fs.existsSync(checkpointPath), 'The script smoke did not create its isolated checkpoint')
    const value = JSON.parse(fs.readFileSync(checkpointPath!, 'utf8'))
    check(value.version === 7 && value.scripts?.engine?.version === 1, 'The saved checkpoint omitted versioned script state')
    return value.scripts
  }
  async function noReplay(epoch: number) {
    const until = Date.now() + 1800
    while (Date.now() < until) {
      const state = await read()
      check(!state.error && state.game?.running && state.scriptEpoch === epoch && state.game.scriptMessage === null &&
        state.scriptText === null && Object.keys(state.game.clientScriptState).length === 0,
      'A loaded script epoch replayed an old presentation or stopped the scene')
      await delay(60)
    }
  }
  async function connectObserver() {
    const session = await evaluate('globalThis.AGate._engine.client.options.authoritySession')
    observer = io(session.url, { auth: { version: 2, token: session.observerToken }, transports: ['websocket'],
      reconnection: false, autoConnect: false, forceNew: true, timeout: 5000 })
    observer.on('authority:snapshot', value => { snapshots.push(value); if (snapshots.length > 256) snapshots.shift() })
    observer.on('authority:presentation', value => observerMessages.push(value))
    await bounded(new Promise<void>((resolve, reject) => {
      observer!.once('connect', resolve); observer!.once('connect_error', reject); observer!.connect()
    }))
    const joined = await bounded(observer.timeout(5000).emitWithAck('authority:join', { version: 2 }))
    check(joined?.ok && joined.version === 2 && joined.role === 'observer', 'The script smoke observer did not join')
    snapshots.push(joined.snapshot)
  }
  async function publicConvergence(state: RendererValue) {
    const until = Math.min(started + timeout, Date.now() + 5000)
    while (Date.now() < until) {
      const snapshot = snapshots.find(value => value.revision === state.game.authority.revision)
      if (snapshot) {
        check(snapshot.scriptEpoch === state.scriptEpoch && JSON.stringify(snapshot.scriptObjects) === JSON.stringify(state.game.scriptObjects) &&
          JSON.stringify(snapshot.actors.find(value => value.id === '0')) === JSON.stringify(state.game.authority.actor),
        'The owner renderer and observer disagree on the committed public script state')
        check(observerMessages.length === 0 && !/"(?:scriptId|counters|shared|players|data|scheduled|text)"\s*:/.test(JSON.stringify(snapshot)),
          'The script observer received private presentation, counters or module state')
        return { revision: snapshot.revision, epoch: snapshot.scriptEpoch, privateEffects: observerMessages.length, off: snapshot.scriptObjects }
      }
      await delay(30)
    }
    throw new Error('The script observer missed the committed snapshot')
  }
  try {
    if (testInput) report.startPoint = await button('start-game')
    else await evaluate(`(() => { const button=document.querySelector('[data-action="start-game"]'); if(!button || button.disabled) throw new Error('Script smoke startup is unavailable'); button.click(); })()`)
    report.initial = await waitFor(state => state.status === 'running' && state.game?.ready && state.game?.running, 'Script smoke scene did not start')
    const initial = report.initial
    check(initial.game.authority?.protocolVersion === 2 && initial.target && initial.scriptEpoch === 1, 'The script scene lacks its authoritative object or initial epoch')
    await connectObserver()
    if (owned) {
      check(initial.game.map.id === 'Inventory workshop' && !initial.target.off && initial.target.rendered && initial.target.visible &&
        initial.target.blocked && initial.door?.open === false && initial.game.scriptMessage === null,
      'The owned scripted door and visible, colliding guide did not start cleanly')
      report.veto = await action('use')
      check(report.veto.door.open === false && report.veto.game.interaction.message === 'The script prevented the default action.',
        'The first script Use failed to veto the ordinary closed-door action')
      report.hidden = await waitFor(state => state.target.off && !state.target.visible && !state.target.renderable && state.target.eventMode === 'none' &&
        !state.target.blocked && state.game.scriptMessage?.text.includes('refuses') && state.scriptText?.includes('refuses') &&
        state.game.clientScriptState['workshop:presentation']?.messages === 1, 'The owned client module did not display the private veto or hide the guide')
      check(!report.hidden.target.inheritedOff && report.hidden.target.ownOff, 'The owned script mutated inherited Off flags')
      report.vetoObserver = await publicConvergence(report.hidden)
      const idleCommand = report.hidden.game.authority.actor.lastCommand.id, frames = report.hidden.game.frameCount
      report.idle = await waitFor(state => state.game.scriptMessage?.text.includes('while the world was idle') &&
        state.scriptText?.includes('while the world was idle') && state.game.clientScriptState['workshop:presentation']?.messages === 2,
      'The scheduled script message did not run while the world was idle')
      check(report.idle.game.authority.actor.lastCommand.id === idleCommand && report.idle.game.frameCount > frames,
        'The delayed effect required a new gameplay command or a stopped renderer')
      report.savedHidden = await action('save')
      const firstSave = saved()
      check(firstSave.engine.attachments[`${SCRIPTED_DOOR_ID}#1`]?.counters[0] === 1 && firstSave.engine.data['workshop:door']?.value.uses === 1 &&
        firstSave.engine.shared.variables['workshop:0'] === 1 && firstSave.engine.off[NPC_ID] === true && firstSave.engine.scheduled.length === 0,
      'The owned checkpoint omitted counters, custom data, shared state or drained timer state')
      report.secondUse = await action('use')
      check(report.secondUse.door.open && !report.secondUse.target.off && report.secondUse.target.visible && report.secondUse.target.renderable &&
        report.secondUse.target.eventMode === initial.target.eventMode && report.secondUse.target.blocked &&
        report.secondUse.game.clientScriptState['workshop:presentation']?.messages === 3,
      'The second Use did not run the door default and restore the guide')
      report.restoredHidden = await action('load')
      check(report.restoredHidden.scriptEpoch > initial.scriptEpoch && !report.restoredHidden.door.open && report.restoredHidden.target.off &&
        !report.restoredHidden.target.visible && !report.restoredHidden.target.blocked,
      'Load did not restore the saved hidden guide, closed door and new script epoch')
      await noReplay(report.restoredHidden.scriptEpoch)
      report.loadedObserver = await publicConvergence(await read())
      report.restoredSecondUse = await action('use')
      check(report.restoredSecondUse.door.open && !report.restoredSecondUse.target.off && report.restoredSecondUse.target.visible &&
        report.restoredSecondUse.game.clientScriptState['workshop:presentation']?.messages === 1,
      'The restored counter replayed first-Use veto instead of allowing the default')
      await action('save')
      const finalSave = saved()
      check(finalSave.engine.attachments[`${SCRIPTED_DOOR_ID}#1`]?.counters[0] === 2 && finalSave.engine.data['workshop:door']?.value.uses === 2 &&
        finalSave.engine.shared.variables['workshop:0'] === 2 && finalSave.engine.off[NPC_ID] === false && finalSave.engine.scheduled.length === 0,
      'Restored script data or counters failed to continue from the checkpoint')
      report.persistence = { counter: 2, customUses: 2, sharedUses: 2, noPresentationReplay: true }
    } else {
      check(initial.game.map.id === 'Bates Mansion Lev 2', 'The original script check loaded another map')
      report.disabled = await waitFor(state => state.target.off && !state.target.visible && state.collisionTarget?.off && state.game.scriptObjects.some(value => value.id === ORIGINAL_GUARD && value.off),
        'Original script 2894 did not disable the guard after flag2676 was initialized')
      check(!report.disabled.target.inheritedOff && report.disabled.target.ownOff &&
        (!report.disabled.target.rendered || (!report.disabled.target.renderable && report.disabled.target.eventMode === 'none')),
      'The original guard remained drawn or interactive after its instance Off write')
      const collision = report.disabled.collisionTarget
      check(collision.floor.exists && collision.floor.type === 'Tile' && !collision.floor.blocked &&
        collision.occupants.length === 1 && collision.occupants[0].id === ORIGINAL_COLLISION_GUARD &&
        !collision.inheritedOff && collision.ownOff && !collision.visible && !collision.renderable && collision.eventMode === 'none' &&
        !collision.blocked && !collision.blockedByLocation,
      `The clear secondary guard still contributes native collision or rendering: ${JSON.stringify(collision)}`)
      check(report.disabled.target.blocked && report.disabled.target.blockedByLocation &&
        report.disabled.target.occupants.some(value => value.id !== ORIGINAL_GUARD && !value.off && !value.noBlock &&
          !value.inventory && !value.destroyed && value.type === 'Wall'),
      `Disabling the primary guard removed its independent solid wall: ${JSON.stringify(report.disabled.target)}`)
      report.saved = await action('save')
      const firstSave = saved(), collisionHeartbeat = `${ORIGINAL_COLLISION_GUARD}#19`, heartbeat = `${ORIGINAL_GUARD}#19`, dialog = `${ORIGINAL_GUARD}#9`
      check(firstSave.engine.attachments[heartbeat]?.scriptId === '' && firstSave.engine.off[ORIGINAL_GUARD] === true &&
        firstSave.engine.attachments[collisionHeartbeat]?.scriptId === '' && firstSave.engine.off[ORIGINAL_COLLISION_GUARD] === true,
        'The original guard heartbeat did not remove its own attachment after disabling the NPC')
      const dialogBinding = firstSave.engine.attachments[dialog]
      report.loaded = await action('load')
      check(report.loaded.scriptEpoch > initial.scriptEpoch && report.loaded.target.off && !report.loaded.target.visible,
        'The original guard Off state did not survive checkpoint restoration')
      await noReplay(report.loaded.scriptEpoch)
      report.afterIdle = await read()
      check(report.afterIdle.target.off && !report.afterIdle.target.visible && report.afterIdle.target.blocked &&
        report.afterIdle.collisionTarget.off && !report.afterIdle.collisionTarget.visible && !report.afterIdle.collisionTarget.blocked &&
        !report.afterIdle.collisionTarget.blockedByLocation,
        'The removed original heartbeat retoggled the guard after load')
      await action('save')
      const restored = saved()
      check(restored.engine.attachments[heartbeat]?.scriptId === '' && JSON.stringify(restored.engine.attachments[dialog]) === JSON.stringify(dialogBinding) &&
        restored.engine.off[ORIGINAL_GUARD] === true && restored.engine.attachments[collisionHeartbeat]?.scriptId === '' &&
        restored.engine.off[ORIGINAL_COLLISION_GUARD] === true && restored.engine.clockMs > firstSave.engine.clockMs,
      'The restored idle scheduler lost removal state, altered another attachment or failed to advance')
      report.persistence = { heartbeatRemoved: true, dialogPreserved: true, noRetoggle: true, noPresentationReplay: true,
        collisionGuard: ORIGINAL_COLLISION_GUARD, guardTileUnblocked: true, independentWallRetained: true }
    }
    report.final = await read()
    report.observer = await publicConvergence(report.final)
    check(observerMessages.length === 0, 'An observer received an owner-private script effect')
    report.ok = true
  } catch (error) {
    report.error = `Script check failed: ${error instanceof Error ? error.message : String(error)}`
    if (lastRead) report.lastState = lastRead
  }
  finally { observer?.removeAllListeners(); observer?.disconnect() }
  report.elapsedMs = Date.now() - started
  return report
}

module.exports = { runScriptSmoke }
