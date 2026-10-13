import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { transformAsync } from '@babel/core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const engine = path.join(root, '@openarcanum/agate')

await build({
  absWorkingDir: root,
  entryPoints: {
    index: path.join(engine, 'src/AGate.js'),
    authority: path.join(engine, 'src/server/authority/entry.js'),
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
  plugins: [{
    name: 'strip-engine-flow-types',
    setup(builder) {
      builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
        if (!filename.startsWith(path.join(engine, 'src') + path.sep)) return
        const source = await fs.readFile(filename, 'utf8')
        const transformed = await transformAsync(source, {
          filename,
          configFile: false,
          babelrc: false,
          plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
          sourceMaps: 'inline',
        })
        return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
      })
    },
  }],
})
console.log('Built AGate client and headless authority → @openarcanum/agate/dist/')
