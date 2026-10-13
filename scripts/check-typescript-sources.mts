import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = ['app', 'tests', 'config', 'scripts', 'types', 'ember-electron', 'examples',
  '@openarcanum/agate/src', '@openarcanum/agate/tests', '@openarcanum/agate/tools',
  '@openarcanum/asset-converter/lib', '@openarcanum/asset-db/scripts']
const generatedConfigs = new Set(['targets', 'project', 'flexi', 'environment', 'ember-intl'])
const violations: string[] = []
let sources = 0

async function check(directory: string): Promise<void> {
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`
    // The bundled PSON library and FlatBuffers output are upstream/generated.
    if (relative === '@openarcanum/agate/src/libs/PSON' ||
        relative === '@openarcanum/agate/src/shared/entity/schemas/entity_generated.js') continue
    if (entry.isDirectory()) { await check(relative); continue }
    if (/\.[cm]?js$/.test(entry.name)) {
      if (directory === 'config' && generatedConfigs.has(entry.name.replace(/\.js$/, ''))) continue
      violations.push(`${relative}: authored JavaScript source must be TypeScript`)
    }
    if (/\.[cm]?ts$/.test(entry.name)) {
      sources++
      const source = await fs.readFile(path.join(root, relative), 'utf8')
      if (/@ts-(?:nocheck|ignore)\b/.test(source)) violations.push(`${relative}: unchecked TypeScript suppression`)
    }
  }
}

for (const directory of sourceRoots) await check(directory)
for (const entry of await fs.readdir(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (/\.[cm]?js$/.test(entry.name) && entry.name !== 'ember-cli-build.mjs') {
    violations.push(`${entry.name}: authored JavaScript source must be TypeScript`)
  }
  if (/\.[cm]?ts$/.test(entry.name)) {
    sources++
    const source = await fs.readFile(path.join(root, entry.name), 'utf8')
    if (/@ts-(?:nocheck|ignore)\b/.test(source)) violations.push(`${entry.name}: unchecked TypeScript suppression`)
  }
}
const compiler = JSON.parse(await fs.readFile(path.join(root, 'node_modules/typescript/package.json'), 'utf8')) as { version: string }
if (!compiler.version.startsWith('7.')) violations.push(`Expected TypeScript 7, received ${compiler.version}`)
for (const filename of await fs.readdir(root)) {
  if (!/^tsconfig.*\.json$/.test(filename)) continue
  const config = JSON.parse(await fs.readFile(path.join(root, filename), 'utf8')) as { compilerOptions?: { allowJs?: boolean; checkJs?: boolean } }
  if (config.compilerOptions?.allowJs || config.compilerOptions?.checkJs) violations.push(`${filename}: JavaScript compilation enabled`)
}
if (violations.length) throw new Error(violations.join('\n'))
console.log(`TypeScript ${compiler.version}: ${sources} authored source/declaration files; no authored JavaScript or unchecked suppressions.`)
