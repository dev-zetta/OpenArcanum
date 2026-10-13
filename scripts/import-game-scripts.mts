import { createRequire } from 'node:module'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
const require = createRequire(import.meta.url)
const StreamZip = require('node-stream-zip') as typeof import('node-stream-zip')
const { importGameScripts } = require('../@openarcanum/asset-converter/dist/src/scripts/GameScriptImporter.cjs') as typeof import('../@openarcanum/asset-converter/lib/src/scripts/GameScriptImporter.cjs')

const defaults = {archive: 'local-data/unpacked_data.zip', output: 'local-data/scripts/arcanum',
  descriptions: '../my_projects/OpenArcanumCpp/Data/data_wip/mes/Arcanum/semes'}
const options: Record<string, string> = {...defaults}
const args = process.argv.slice(2)
for (let index = 0; index < args.length; index += 2) {
  const key = args[index]?.replace(/^--/, '')
  if (!key || !['archive', 'output', 'descriptions', 'reviewed-aliases'].includes(key) || !args[index + 1]) {
    throw new Error('Usage: node scripts/import-game-scripts.mts [--archive ZIP] [--output DIRECTORY] [--descriptions SEMES_DIRECTORY] [--reviewed-aliases JSON]')
  }
  options[key] = args[index + 1]
}
const aliasFilename = options['reviewed-aliases'] || path.join(options.output, 'reviewed-aliases.json')
let reviewedAliases: import('../@openarcanum/asset-converter/lib/src/scripts/SharedSymbolCatalog.cjs').ReviewedAliases | undefined
try {reviewedAliases = JSON.parse(await fs.readFile(aliasFilename, 'utf8')) as typeof reviewedAliases} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}
const zip = new StreamZip.async({file: options.archive})
try {
  const result = await importGameScripts({archive: {names: async () => Object.keys(await zip.entries()), read: name => zip.entryData(name)},
    output: options.output, globalFlags: await fs.readFile(path.join(options.descriptions, 'globalflags.mes')),
    globalVariables: await fs.readFile(path.join(options.descriptions, 'globalvars.mes')), reviewedAliases})
  console.log(JSON.stringify(result, null, 2))
} finally {await zip.close()}
