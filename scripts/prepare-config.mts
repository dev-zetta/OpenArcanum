import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Ember CLI still discovers conventional JavaScript config names. These files
// are generated from checked TypeScript; runtime code lives in source .cts/.mts.
for (const entry of await fs.readdir(path.join(root, 'dist-config/config'))) {
  if (!entry.endsWith('.cjs')) continue
  await fs.copyFile(path.join(root, 'dist-config/config', entry), path.join(root, 'config', entry.replace(/\.cjs$/, '.js')))
}
await build({ absWorkingDir: root, entryPoints: ['ember-cli-build.mts'], outfile: 'ember-cli-build.mjs',
  bundle: false, platform: 'node', format: 'esm', target: 'node24', sourcemap: true })
