const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.resolve(__dirname, '../../..')
const source = path.join(root, '@openarcanum/agate/src')
const fixture = path.join(root, '@openarcanum/agate/dist/renderer-smoke.cjs')

async function main() {
  const { build } = await import('esbuild')
  const { transformAsync } = await import('@babel/core')
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(__dirname, 'renderer-smoke-entry.js')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    external: ['electron', 'workerpool'],
    loader: { '.glsl': 'text' },
    plugins: [{
      name: 'renderer-smoke-flow',
      setup(builder) {
        builder.onLoad({ filter: /\.js$/ }, async ({ path: filename }) => {
          if (!filename.startsWith(source + path.sep)) return
          const transformed = await transformAsync(await fs.readFile(filename, 'utf8'), {
            filename,
            configFile: false,
            babelrc: false,
            plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: false }]],
          })
          return { contents: transformed.code, loader: 'js', resolveDir: path.dirname(filename) }
        })
      },
    }],
  })
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require('electron'), [path.join(__dirname, 'renderer-smoke-electron.cjs'), fixture], {
    cwd: root,
    env,
    stdio: 'inherit'
  })
  child.on('error', error => { console.error(error); process.exitCode = 1 })
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Renderer smoke exited with ${signal}`)
    process.exitCode = code === null ? 1 : code
  })
}

main().catch(error => { console.error(error); process.exitCode = 1 })
