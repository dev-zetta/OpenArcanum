import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = path.join(root, '@openarcanum/agate')
await build({
  absWorkingDir: root,
  entryPoints: {
    index: path.join(engine, 'src/AGate.ts'),
    authority: path.join(engine, 'src/server/authority/entry.ts'),
  },
  outdir: path.join(engine, 'dist'),
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  loader: { '.glsl': 'text' },
  sourcemap: true,
  external: ['electron', 'workerpool'],
})
console.log('Built AGate engine and headless authority for Electron')
