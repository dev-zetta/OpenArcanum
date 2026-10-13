import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { createAuthorityServer, DEFAULT_MAP, PROTOCOL_VERSION } from './AuthorityServer'

let server
let starting = false
let shuttingDown = false
let pendingStop = false

async function stop() {
  pendingStop = true
  if (starting || shuttingDown) return
  shuttingDown = true
  try { await server?.stop() }
  finally {
    if (process.connected) process.disconnect()
    process.exitCode = 0
  }
}

async function start(config, child = false) {
  if (starting || server || pendingStop) return
  starting = true
  try {
    server = createAuthorityServer(config)
    const ready = await server.start()
    starting = false
    if (pendingStop) { await stop(); return }
    if (child) process.send({ type: 'ready', protocolVersion: PROTOCOL_VERSION,
      version: PROTOCOL_VERSION, url: ready.url, port: ready.port, mapId: ready.mapId })
    else {
      // CLI tokens are deliberately never printed. A private session file can
      // be supplied when a developer needs to connect a separate local client.
      if (config.sessionFile) {
        await fs.mkdir(path.dirname(path.resolve(config.sessionFile)), { recursive: true })
        await fs.writeFile(config.sessionFile, `${JSON.stringify(ready, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
      }
      console.info(`OpenArcanum authority v${PROTOCOL_VERSION} listening on ${ready.url}; map=${ready.mapId}`)
    }
  } catch (error) {
    starting = false
    if (child && process.connected) process.send({ type: 'error', message: error.message })
    else console.error(`Authority startup failed: ${error.message}`)
    await server?.stop()
    if (process.connected) process.disconnect()
    process.exitCode = 1
  }
}

process.once('SIGINT', stop)
process.once('SIGTERM', stop)
if (process.send) {
  process.on('message', message => {
    if (message?.type === 'start') start(message.config, true)
    else if (message?.type === 'stop') stop()
  })
  process.once('disconnect', stop)
} else main()

async function main() {
  try {
    const { values } = parseArgs({ options: {
      'data-path': { type: 'string' }, 'map-id': { type: 'string' },
      port: { type: 'string' }, config: { type: 'string' },
      'session-file': { type: 'string' }, help: { type: 'boolean' },
      'checkpoint-path': { type: 'string' },
    } })
    if (values.help) {
      console.info('Usage: node authority.cjs --data-path PATH [--map-id NAME] [--port 0] [--session-file PRIVATE_PATH] [--checkpoint-path PATH] [--config JSON_PATH]')
    } else {
      const config = values.config ? JSON.parse(await fs.readFile(values.config, 'utf8')) : {}
      await start({ ...config, dataPath: values['data-path'] || config.dataPath,
        mapId: values['map-id'] || config.mapId || DEFAULT_MAP,
        port: values.port === undefined ? (config.port || 0) : Number(values.port),
        sessionFile: values['session-file'] || config.sessionFile,
        checkpointPath: values['checkpoint-path'] || config.checkpointPath })
    }
  } catch (error) {
    console.error(`Authority arguments failed: ${error.message}`)
    process.exitCode = 1
  }
}
