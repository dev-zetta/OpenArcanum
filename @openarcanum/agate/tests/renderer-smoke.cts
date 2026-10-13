const path = require('node:path') as typeof import('node:path')
const { spawn } = require('node:child_process') as typeof import('node:child_process')
const root = path.resolve(__dirname, '../../..')
const fixture = path.join(root, '@openarcanum/agate/dist/renderer-smoke.cjs')
const softwareRendering = process.argv.includes('--software-rendering')

async function main() {
  const { build } = await import('esbuild')
  await build({
    absWorkingDir: root,
    entryPoints: [path.join(__dirname, 'renderer-smoke-entry.ts')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    external: ['electron', 'workerpool'],
    loader: { '.glsl': 'text' },
  })
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const smokeArgs = softwareRendering ? ['--software-rendering'] : []
  const child = spawn(require('electron'), [path.join(__dirname, 'renderer-smoke-electron.cts'), fixture, ...smokeArgs], {
    cwd: root,
    env,
    stdio: 'inherit'
  })
  child.on('error', (error: NodeJS.ErrnoException) => { console.error(error); process.exitCode = 1 })
  child.on('exit', (code, signal) => {
    if (signal) console.error(`Renderer smoke exited with ${signal}`)
    process.exitCode = code === null ? 1 : code
  })
}

main().catch((error: NodeJS.ErrnoException) => { console.error(error); process.exitCode = 1 })
