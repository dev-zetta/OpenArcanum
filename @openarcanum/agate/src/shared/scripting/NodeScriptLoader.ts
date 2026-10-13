import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import Module, { createRequire } from 'node:module'
import * as api from './ScriptApi'
import { ScriptError, validateDefinition } from './ScriptEngine'
import { type ScriptDefinition, type ScriptRealm, type ScriptResolver, type ScriptSymbols } from './ScriptApi'

export interface ScriptManifestEntry { id: string; realm: ScriptRealm; source: string; compiled: string; sourceSha256: string; sha256: string }
export interface ScriptManifestFile { path: string; sha256: string }
export interface ScriptManifest { apiVersion: 1; scripts: ScriptManifestEntry[]; symbols?: ScriptSymbols; files?: ScriptManifestFile[] }
interface CompilableModule extends NodeModule { _compile(source: string, filename: string): void }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const digest = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex')

/** Trusted-local CJS loader. Confines manifest files to one real directory,
 * verifies source AND output hashes, and gives each session its own private
 * module cache. This intentionally makes no sandbox/security claim for JS. */
export default class NodeScriptLoader implements ScriptResolver {
  readonly contentIdentity: string
  readonly manifest: Readonly<ScriptManifest>
  readonly symbols: ScriptSymbols
  private readonly directory: string
  private readonly realm: ScriptRealm
  private readonly modules = new Map<string, CompilableModule>()
  private readonly scripts = new Map<string, ScriptDefinition>()
  private readonly entries = new Map<string, ScriptManifestEntry>()
  private readonly files: ScriptManifestFile[] = []
  private disposed = false
  constructor(manifestPath: string, { realm }: { realm: ScriptRealm }) {
    if (!['server', 'client'].includes(realm)) throw new ScriptError('WRONG_REALM', 'Invalid loader realm')
    this.realm = realm
    const filename = fs.realpathSync(manifestPath)
    this.directory = fs.realpathSync(path.dirname(filename))
    const bytes = fs.readFileSync(filename)
    if (bytes.length > 4 * 1024 * 1024) throw new ScriptError('INVALID_MANIFEST', 'Script manifest is too large')
    const raw: unknown = JSON.parse(bytes.toString('utf8'))
    if (!object(raw) || raw.apiVersion !== api.API_VERSION || !Array.isArray(raw.scripts) || raw.scripts.length > 10000) throw new ScriptError('INVALID_MANIFEST', 'Invalid script manifest or API version')
    const scripts: ScriptManifestEntry[] = []
    for (const value of raw.scripts) {
      if (!object(value) || typeof value.id !== 'string' || !/^[a-z][a-z0-9_-]*:[a-zA-Z0-9_.-]+$/.test(value.id) ||
        !['server', 'client'].includes(String(value.realm)) || typeof value.source !== 'string' || typeof value.compiled !== 'string' ||
        typeof value.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSha256) || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) || this.entries.has(value.id)) throw new ScriptError('INVALID_MANIFEST', 'Invalid or duplicate script manifest entry')
      const entry: ScriptManifestEntry = { id: value.id, realm: value.realm as ScriptRealm, source: value.source, compiled: value.compiled, sourceSha256: value.sourceSha256, sha256: value.sha256 }
      if (!entry.compiled.endsWith('.cjs') || !/\.(ts|cts)$/.test(entry.source)) throw new ScriptError('INVALID_MANIFEST', 'Scripts require TS sources and compiled CJS output')
      this.verified(entry.source, entry.sourceSha256); this.verified(entry.compiled, entry.sha256)
      this.entries.set(entry.id, entry); scripts.push(entry)
    }
    if (raw.files !== undefined) {
      if (!Array.isArray(raw.files) || raw.files.length > 20000) throw new ScriptError('INVALID_MANIFEST', 'Invalid source dependency list')
      const seen = new Set<string>()
      for (const value of raw.files) {
        if (!object(value) || typeof value.path !== 'string' || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) || seen.has(value.path)) throw new ScriptError('INVALID_MANIFEST', 'Invalid or duplicate source dependency')
        this.verified(value.path, value.sha256); seen.add(value.path); this.files.push({ path: value.path, sha256: value.sha256 })
      }
    }
    this.symbols = {}
    if (raw.symbols !== undefined) {
      if (!object(raw.symbols) || Object.keys(raw.symbols).some(name => !['variables', 'flags'].includes(name))) throw new ScriptError('INVALID_MANIFEST', 'Invalid script symbol table')
      for (const field of ['variables', 'flags'] as const) {
        const names = raw.symbols[field]
        if (names === undefined) continue
        if (!object(names)) throw new ScriptError('INVALID_MANIFEST', 'Invalid script symbol table')
        const output: Record<string, number> = {}
        for (const [name, id] of Object.entries(names)) {
          if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name) || typeof id !== 'number' || !Number.isSafeInteger(id) || id < 0 || id > 65535) throw new ScriptError('INVALID_MANIFEST', 'Invalid script symbol alias')
          output[name] = id
        }
        this.symbols[field] = Object.freeze(output)
      }
      Object.freeze(this.symbols)
    }
    this.manifest = Object.freeze({ apiVersion: api.API_VERSION, scripts: scripts.map(entry => Object.freeze({ ...entry })), symbols: this.symbols, files: this.files.map(file => Object.freeze({ ...file })) })
    this.contentIdentity = digest(JSON.stringify({ apiVersion: api.API_VERSION, scripts: [...scripts].sort((a, b) => a.id.localeCompare(b.id)), symbols: this.symbols, files: [...this.files].sort((a, b) => a.path.localeCompare(b.path)) }))
  }
  private confined(relative: string): string {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(part => part === '..' || part === '' || part === '.')) throw new ScriptError('INVALID_PATH', 'Script path must stay inside its module directory')
    const filename = fs.realpathSync(path.join(this.directory, relative))
    if (filename !== this.directory && !filename.startsWith(`${this.directory}${path.sep}`)) throw new ScriptError('INVALID_PATH', 'Script path escapes its module directory')
    if (!fs.statSync(filename).isFile()) throw new ScriptError('INVALID_PATH', 'Script path is not a regular file')
    return filename
  }
  private verified(relative: string, expected: string): string {
    const filename = this.confined(relative), bytes = fs.readFileSync(filename)
    if (bytes.length > 8 * 1024 * 1024 || digest(bytes) !== expected) throw new ScriptError('CONTENT_MISMATCH', 'Script source/output content changed; rebuild its manifest')
    return filename
  }
  private load(filename: string): unknown {
    if (this.disposed) throw new ScriptError('SCRIPT_DISPOSED', 'Script module session has ended')
    const existing = this.modules.get(filename)
    if (existing) return existing.exports as unknown
    const compiled = new Module(filename) as unknown as CompilableModule
    compiled.filename = filename; compiled.paths = []
    const nativeRequire = createRequire(filename)
    compiled.require = (request: string): unknown => {
      if (request === '@openarcanum/script-api' || request === '@openarcanum/agate/script-api') return api
      if (request.startsWith('.')) {
        const resolved = nativeRequire.resolve(request)
        const relative = path.relative(this.directory, resolved).split(path.sep).join('/')
        const confined = this.confined(relative)
        // Private helper files must themselves be covered by a compiled manifest
        // entry, so unhashed dependencies cannot change checkpoint identity.
        const entry = [...this.entries.values()].find(value => this.confined(value.compiled) === confined)
        if (!entry || entry.realm !== this.realm) throw new ScriptError('INVALID_IMPORT', 'Private script dependency is not declared in this realm')
        this.verified(entry.compiled, entry.sha256); return this.load(confined)
      }
      // Authored modules are trusted local code; builtin/package access remains
      // ordinary Node behavior and is deliberately not presented as isolation.
      return nativeRequire(request) as unknown
    }
    this.modules.set(filename, compiled)
    try { compiled._compile(fs.readFileSync(filename, 'utf8'), filename); compiled.loaded = true; return compiled.exports as unknown }
    catch (error) { this.modules.delete(filename); throw error }
  }
  resolve(id: string, realm: ScriptRealm): ScriptDefinition | undefined {
    if (this.disposed) throw new ScriptError('SCRIPT_DISPOSED', 'Script module session has ended')
    if (realm !== this.realm) throw new ScriptError('WRONG_REALM', 'Script loader realm mismatch')
    const entry = this.entries.get(id)
    if (!entry) return undefined
    if (entry.realm !== realm) throw new ScriptError('WRONG_REALM', 'Script manifest realm mismatch')
    for (const file of this.files) this.verified(file.path, file.sha256)
    this.verified(entry.source, entry.sourceSha256)
    const filename = this.verified(entry.compiled, entry.sha256)
    const existing = this.scripts.get(id)
    if (existing) return existing
    const exports = this.load(filename)
    const definition = object(exports) && 'default' in exports ? exports.default : exports
    if (!object(definition) || definition.id !== id) throw new ScriptError('INVALID_SCRIPT', 'Compiled script identity differs from its manifest')
    validateDefinition(definition as unknown as ScriptDefinition, realm)
    const script = definition as unknown as ScriptDefinition
    this.scripts.set(id, script); return script
  }
  dispose(): void {
    this.disposed = true
    this.scripts.clear()
    this.modules.clear()
    this.entries.clear()
    this.files.length = 0
  }
}
