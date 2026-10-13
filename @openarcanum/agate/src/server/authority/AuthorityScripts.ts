import { createHash, randomInt } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import ScriptEngine, { type PreparedScriptTransaction, type ScriptSnapshot } from '../../shared/scripting/ScriptEngine'
import NodeScriptLoader from '../../shared/scripting/NodeScriptLoader'
import type { ScriptHost, ScriptObject, ScriptPresentation, ScriptResolver } from '../../shared/scripting/ScriptApi'
import { record, integer, type AuthorityMap, type AuthorityEntity } from './AuthorityTypes'
import { prepareOwnWrites } from './InventoryOwnership'

interface Binding { scriptId: string | null; flags: number; counters: number[] }
interface Heartbeat { objectId: string; attachmentId: string; remainingMs: number }
export interface AuthorityScriptSnapshot { version: 1; engine: ScriptSnapshot; heartbeats: Heartbeat[]; rng: number }
export interface PreparedAuthorityRestore { transaction: PreparedScriptTransaction; heartbeats: Heartbeat[]; rng: number }
const attachmentId = (objectId: string, slot: number) => `${objectId}#${slot}`
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const emptyResolver: ScriptResolver = { contentIdentity: hash('openarcanum-no-scripts-v1'), resolve: () => undefined }

/** Original bindings and heartbeat policy are data; the renderer never dispatches them. */
export default class AuthorityScripts {
  readonly engine: ScriptEngine
  readonly contentIdentity: string
  readonly bindings = new Map<string, Map<number, Binding>>()
  readonly inactiveHeartbeats: { objectId: string; scriptId: string }[] = []
  private heartbeats: Heartbeat[] = []
  private rng = randomInt(1, 0x100000000)
  private readonly objects = new Map<string, AuthorityEntity>()
  private tickFailure: Error | null = null
  private constructor(map: AuthorityMap, player: AuthorityEntity, resolver: ScriptResolver,
    symbols: ConstructorParameters<typeof ScriptEngine>[0]['symbols'], effects: (effect: ScriptPresentation) => void, initialFlags?: ConstructorParameters<typeof ScriptEngine>[0]['initialFlags']) {
    for (const entity of map.entityManager.entities.values()) if (entity.sourcePath) this.objects.set(entity.sourcePath, entity)
    this.objects.set(player.id, player)
    const host: ScriptHost = {
      getObject: id => {
        const entity = this.objects.get(id)
        if (!entity || entity.map !== map) return null
        const value: ScriptObject = { id, type: entity.base.type, prototype: entity.base.prototype,
          location: [entity.base.location.x, entity.base.location.y] }
        return value
      },
      isOff: id => { const entity = this.objects.get(id); return !!entity && (entity.scriptOff ?? entity.base.flags.has('Off')) },
      prepareObjectWrites: writes => prepareOwnWrites(writes.map(write => {
        const entity = this.objects.get(write.targetId)
        // This milestone implements instance Off state for NPCs, without
        // pretending inventory/portal destruction or PC removal are supported.
        if (!entity || entity.map !== map || entity.base.type !== 'Npc' || entity.base.flags.has('Destroyed')) throw new Error(`Unsupported script Off target: ${write.targetId}`)
        return [entity, 'scriptOff', write.off]
      })),
      emitPresentation: effects,
    }
    this.engine = new ScriptEngine({ host, resolver, symbols, initialFlags, seed: randomInt(1, 0x100000000) })
    this.contentIdentity = resolver.contentIdentity
  }
  static async load(options: { map: AuthorityMap; player: AuthorityEntity; dataPath: string; manifestPath?: string;
    initialFlags?: ConstructorParameters<typeof ScriptEngine>[0]['initialFlags']; bindings: unknown; descriptor: unknown; effects(effect: ScriptPresentation): void }): Promise<AuthorityScripts> {
    const { map, player, dataPath, bindings, descriptor } = options
    let manifestPath = options.manifestPath
    let enabledHeartbeats: string[] = []
    if (descriptor !== null) {
      if (!record(descriptor) || descriptor.format !== 'openarcanum-script-module' || descriptor.version !== 1 || typeof descriptor.manifest !== 'string' ||
        path.isAbsolute(descriptor.manifest) || descriptor.manifest.split(/[\\/]/).includes('..')) throw new Error('Invalid script module descriptor')
      if (!manifestPath) manifestPath = path.join(dataPath, descriptor.manifest)
      if (descriptor.heartbeatScripts !== undefined && (!Array.isArray(descriptor.heartbeatScripts) || descriptor.heartbeatScripts.some(id => typeof id !== 'string'))) throw new Error('Invalid heartbeat compatibility profile')
      enabledHeartbeats = (descriptor.heartbeatScripts as string[] | undefined) || []
    }
    let resolver: ScriptResolver = emptyResolver
    let symbols: ConstructorParameters<typeof ScriptEngine>[0]['symbols']
    if (manifestPath) {
      try { await fs.access(manifestPath); const loader = new NodeScriptLoader(manifestPath, { realm: 'server' }); resolver = loader; symbols = loader.symbols }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || bindings !== null) throw error }
    }
    const runtime = new AuthorityScripts(map, player, resolver, symbols, options.effects, options.initialFlags)
    if (bindings === null) return runtime
    if (!record(bindings) || bindings.format !== 'openarcanum-script-bindings' || bindings.version !== 1 || !record(bindings.objects)) throw new Error('Invalid script bindings')
    for (const [objectId, slots] of Object.entries(bindings.objects)) {
      const entity = runtime.objects.get(objectId)
      if (!entity || !record(slots)) throw new Error(`Script binding object is absent: ${objectId}`)
      const entries = new Map<number, Binding>()
      for (const [slotKey, raw] of Object.entries(slots)) {
        const slot = Number(slotKey)
        if (!/^(0|[1-9][0-9]*)$/.test(slotKey) || !integer(slot) || slot < 0 || slot > 35 || !record(raw) ||
          (raw.scriptId !== null && typeof raw.scriptId !== 'string') || !integer(raw.flags) || raw.flags < 0 || raw.flags > 0xffffffff ||
          !Array.isArray(raw.counters) || raw.counters.length !== 4 || raw.counters.some(value => !integer(value) || value < 0 || value > 255)) throw new Error('Invalid script attachment')
        const binding = raw as unknown as Binding
        entries.set(slot, structuredClone(binding))
        if (binding.scriptId !== null) runtime.engine.registerAttachment(attachmentId(objectId, slot), { ...binding, scriptId: binding.scriptId })
        if (slot === 19 && binding.scriptId !== null && entity.base.type === 'Npc') {
          if (enabledHeartbeats.includes(binding.scriptId)) runtime.heartbeats.push({ objectId, attachmentId: attachmentId(objectId, slot), remainingMs: runtime.delay(entity, player) + runtime.random(0, 5000) })
          else runtime.inactiveHeartbeats.push({ objectId, scriptId: binding.scriptId })
        }
      }
      runtime.bindings.set(objectId, entries)
    }
    return runtime
  }
  private random(min: number, max: number) {
    let seed = this.rng; seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    this.rng = seed >>> 0 || 1
    return min + this.rng % (max - min + 1)
  }
  private distance(entity: AuthorityEntity, player: AuthorityEntity) {
    return Math.max(Math.abs(entity.base.location.x - player.base.location.x), Math.abs(entity.base.location.y - player.base.location.y))
  }
  private delay(entity: AuthorityEntity, player: AuthorityEntity) { return Math.floor(4750 * Math.min(30, this.distance(entity, player)) / 30) + 250 }
  prepareUse(objectId: string, playerId: string): PreparedScriptTransaction | null {
    if (!this.bindings.get(objectId)?.get(1)?.scriptId) return null
    const id = attachmentId(objectId, 1), binding = this.engine.peekBinding(id)
    if (!binding?.scriptId) return null
    return this.engine.prepare({ scriptId: binding.scriptId, attachmentId: id, attachmentPoint: 1,
      triggererId: playerId, attacheeId: objectId, playerId })
  }
  tick(elapsedMs: number, player: AuthorityEntity): boolean {
    if (this.tickFailure) return false
    const elapsed = Math.min(250, Math.max(0, elapsedMs))
    const prior = this.engine.snapshot()
    let changed = false
    try {
      const clock = this.engine.prepareAdvance(elapsed); clock.commit(); clock.flushEffects()
      changed = prior.scheduled.length !== this.engine.snapshot().scheduled.length || clock.objectWrites.length > 0
      for (const heartbeat of this.heartbeats) {
        heartbeat.remainingMs -= Math.round(elapsed * 8)
        if (heartbeat.remainingMs > 0) continue
        const entity = this.objects.get(heartbeat.objectId)
        if (!entity) throw new Error('Heartbeat target disappeared')
        heartbeat.remainingMs = this.delay(entity, player)
        const binding = this.engine.peekBinding(heartbeat.attachmentId)
        if (!binding?.scriptId || (entity.scriptOff ?? entity.base.flags.has('Off')) || entity.base.flags.has('Destroyed') || this.distance(entity, player) > 30) continue
        const transaction = this.engine.prepare({ scriptId: binding.scriptId, attachmentId: heartbeat.attachmentId,
          attachmentPoint: 19, triggererId: heartbeat.objectId, attacheeId: heartbeat.objectId, playerId: player.id })
        transaction.commit(); transaction.flushEffects(); changed ||= transaction.objectWrites.length > 0
      }
      return changed
    } catch (error) {
      this.tickFailure = error instanceof Error ? error : new Error(String(error))
      console.error('Script scheduler stopped:', this.tickFailure.message)
      // Earlier invocations in this tick have already committed. Their Off
      // changes still need a public snapshot even if a later script faults.
      return changed
    }
  }
  get fault(): Readonly<{ code: string; message: string }> | null {
    if (!this.tickFailure) return null
    const failure = this.tickFailure as Error & { code?: unknown }
    return { code: typeof failure.code === 'string' ? failure.code : 'SCRIPT_FAILED', message: failure.message }
  }
  snapshot(): AuthorityScriptSnapshot { return { version: 1, engine: this.engine.snapshot(), heartbeats: structuredClone(this.heartbeats), rng: this.rng } }
  prepareRestore(value: unknown): PreparedAuthorityRestore {
    if (!record(value) || value.version !== 1 || !Array.isArray(value.heartbeats) || !integer(value.rng) || value.rng < 1 || value.rng > 0xffffffff || value.heartbeats.length !== this.heartbeats.length) throw new Error('Invalid script scheduler checkpoint')
    const expected = new Set(this.heartbeats.map(row => row.attachmentId)), seen = new Set<string>()
    for (const raw of value.heartbeats) {
      if (!record(raw) || typeof raw.objectId !== 'string' || typeof raw.attachmentId !== 'string' || !expected.has(raw.attachmentId) || seen.has(raw.attachmentId) ||
        !this.heartbeats.some(row => row.attachmentId === raw.attachmentId && row.objectId === raw.objectId) || !integer(raw.remainingMs) || raw.remainingMs < 0 || raw.remainingMs > 10000) throw new Error('Invalid heartbeat checkpoint')
      seen.add(raw.attachmentId)
    }
    const transaction = this.engine.prepareRestore(value.engine)
    // Validate every saved override, including equal-valued ones which do not
    // produce a host write. A false Portal override must not bypass the NPC-only
    // capability boundary merely because the live Portal is already not Off.
    for (const id of Object.keys(transaction.candidate.off)) {
      const entity = this.objects.get(id)
      if (!entity || entity.base.type !== 'Npc' || entity.base.flags.has('Destroyed')) throw new Error('Invalid script Off checkpoint target')
    }
    const actualAttachments = Object.keys(transaction.candidate.attachments).sort()
    const initialAttachments = [...this.bindings].flatMap(([id, entries]) => [...entries].filter(([, binding]) => binding.scriptId !== null).map(([slot]) => attachmentId(id, slot))).sort()
    if (JSON.stringify(actualAttachments) !== JSON.stringify(initialAttachments)) throw new Error('Checkpoint attachment set changed')
    return { transaction, heartbeats: structuredClone(value.heartbeats) as Heartbeat[], rng: value.rng }
  }
  restore(prepared: PreparedAuthorityRestore) {
    prepared.transaction.commit(); this.heartbeats = prepared.heartbeats; this.rng = prepared.rng; this.tickFailure = null
  }
  publicObjects() { return [...this.engine.objects()].sort(([a], [b]) => a.localeCompare(b)).map(([id, off]) => ({ id, off })) }
  dispose() { this.engine.dispose(); this.heartbeats = []; this.bindings.clear(); this.objects.clear() }
}
