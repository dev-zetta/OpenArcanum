import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function build(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build-game-scripts.mts', ...args], { cwd: root, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Script build failed (${code})`)))
  })
}
await build(['--source', 'examples/inventory-workshop/scripts', '--output', 'examples/inventory-workshop/data/scripts'])
try { await fs.access(path.join(root, 'local-data/scripts/arcanum/src')); await build([]) }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
