import { createRequire } from 'node:module'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const sha256 = (bytes: import('node:crypto').BinaryLike) => createHash('sha256').update(bytes).digest('hex')
interface ManifestEntry {id: string; realm: 'server' | 'client'; source: string; compiled: string; sourceSha256: string; sha256: string}
interface Manifest {apiVersion: 1; scripts: ManifestEntry[]; files: {path: string; sha256: string}[]; symbols?: {flags?: Record<string, number>; variables?: Record<string, number>}}
export interface BuildOptions {source: string; output: string; sdkTypes?: string; sdkRuntime?: string}
async function listSources(directory: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw new Error(`Script sources cannot contain symlinks: ${entry.name}`)
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listSources(filename))
    else if (entry.isFile() && /\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) result.push(filename)
  }
  return result.sort()
}
/** Builds only output files. Editable originals are never emitted over, including
 * SharedSymbolCatalog and authored helper modules imported by script entries. */
export async function buildGameScripts(options: BuildOptions): Promise<{manifest: string; scripts: number}> {
  const source = path.resolve(options.source), output = path.resolve(options.output)
  if (source === output || source.startsWith(output + path.sep) || output.startsWith(source + path.sep)) throw new Error('Source and compiled output directories must be separate')
  const sdkTypes = path.resolve(options.sdkTypes || '@openarcanum/agate/dist-types/shared/scripting/ScriptApi.d.ts')
  const sdkRuntime = path.resolve(options.sdkRuntime || '@openarcanum/agate/dist/script-api.cjs')
  await fs.access(sdkTypes); await fs.access(sdkRuntime)
  const inputs = await listSources(source)
  if (!inputs.length) throw new Error('No editable TypeScript scripts found')
  await fs.mkdir(output, {recursive: true})
  const configFile = path.join(output, '.typecheck.json')
  const config = {compilerOptions: {target: 'ES2023', module: 'Preserve', moduleResolution: 'Bundler',
    moduleDetection: 'force', strict: true, noEmit: true, skipLibCheck: false,
    types: ['node'], typeRoots: [path.resolve('node_modules/@types')],
    paths: {'@openarcanum/script-api': [sdkTypes], '@openarcanum/agate/script-api': [sdkTypes]}}, files: inputs}
  await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n')
  const typecheck = spawnSync(path.resolve('node_modules/.bin/tsc'), ['-p', configFile], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
  if (typecheck.error) throw typecheck.error
  if (typecheck.status !== 0) throw new Error(`Editable scripts failed TypeScript7 checking:\n${typecheck.stdout}${typecheck.stderr}`)
  const manifest: Manifest = {apiVersion: 1, scripts: [], files: []}, ids = new Set<string>()
  // A complete candidate dist is prepared before its manifest becomes visible.
  // Content-addressed module filenames keep a previously valid manifest usable
  // if a later compile/definition validation fails.
  for (const filename of inputs) {
    const compiled = await build({entryPoints: [filename], write: false, bundle: true, platform: 'node', target: 'node24',
      format: 'cjs', sourcemap: false, legalComments: 'none',
      alias: {'@openarcanum/script-api': sdkRuntime, '@openarcanum/agate/script-api': sdkRuntime}})
    const contents = compiled.outputFiles[0]?.contents
    if (!contents) throw new Error(`No compiled script output: ${filename}`)
    const hash = sha256(contents), relative = path.relative(source, filename).replaceAll(path.sep, '/')
    const compiledName = `modules/${relative.replace(/\.ts$/, '')}.${hash.slice(0, 16)}.cjs`
    const target = path.join(output, compiledName)
    await fs.mkdir(path.dirname(target), {recursive: true}); await fs.writeFile(target, contents)
    const loaded: unknown = require(target)
    const original = await fs.readFile(filename), originalHash = sha256(original)
    const sourceName = `source/${relative.replace(/\.ts$/, '')}.${originalHash.slice(0, 16)}.ts`
    await fs.mkdir(path.dirname(path.join(output, sourceName)), {recursive: true})
    await fs.writeFile(path.join(output, sourceName), original)
    if (relative.endsWith('SharedSymbolCatalog.ts') && loaded && typeof loaded === 'object' && 'symbols' in loaded) {
      const symbols: unknown = loaded.symbols
      if (!symbols || typeof symbols !== 'object') throw new Error('Invalid generated shared symbol catalog')
      manifest.symbols = symbols as NonNullable<Manifest['symbols']>
    }
    const hasDefinition = loaded && typeof loaded === 'object' && 'default' in loaded
    const definition: unknown = hasDefinition ? loaded.default : null
    if (!hasDefinition) {
      manifest.files.push({path: sourceName, sha256: originalHash})
      continue // Typed helper/symbol modules are checked and hash-covered.
    }
    if (!definition || typeof definition !== 'object' || !('id' in definition) || typeof definition.id !== 'string' ||
        !/^[a-z][a-z0-9_-]*:[a-zA-Z0-9_.-]+$/.test(definition.id) ||
        ('apiVersion' in definition && definition.apiVersion !== 1) ||
        !('realm' in definition) || !['server', 'client'].includes(String(definition.realm)) ||
        !('entryPoints' in definition) || !definition.entryPoints || typeof definition.entryPoints !== 'object' ||
        Array.isArray(definition.entryPoints) || !Object.keys(definition.entryPoints).length ||
        Object.entries(definition.entryPoints).some(([line, handler]) => !/^(0|[1-9][0-9]*)$/.test(line) || typeof handler !== 'function')) {
      throw new Error(`Default export is not a script definition: ${filename}`)
    }
    if (ids.has(definition.id)) throw new Error(`Duplicate script definition ID${definition.id}`)
    ids.add(definition.id)
    manifest.scripts.push({id: definition.id, realm: definition.realm as 'server' | 'client', source: sourceName,
      compiled: compiledName, sourceSha256: originalHash, sha256: hash})
  }
  if (!manifest.scripts.length) throw new Error('No script definition exports found')
  manifest.scripts.sort((a, b) => a.id.localeCompare(b.id))
  const manifestFile = path.join(output, 'manifest.json'), temporary = path.join(output, '.manifest.candidate.json')
  await fs.writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n'); await fs.rename(temporary, manifestFile)
  return {manifest: manifestFile, scripts: manifest.scripts.length}
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const options: Record<string, string> = {source: 'local-data/scripts/arcanum/src', output: 'local-data/scripts/arcanum/dist'}
  const args = process.argv.slice(2)
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, '')
    if (!key || !['source', 'output', 'sdk-types', 'sdk-runtime', 'namespace'].includes(key) || !args[index + 1]) throw new Error('Usage: node scripts/build-game-scripts.mts [--source DIRECTORY] [--output DIRECTORY]')
    options[key] = args[index + 1]
  }
  console.log(JSON.stringify(await buildGameScripts({source: options.source, output: options.output,
    sdkTypes: options['sdk-types'], sdkRuntime: options['sdk-runtime']}), null, 2))
}
