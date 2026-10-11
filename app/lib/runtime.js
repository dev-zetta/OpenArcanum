import config from 'open-arcanum/config/environment'

export function getRuntimeConfig() {
  return globalThis.openArcanumDesktop?.config || config.AGate || {}
}

export function getAGate() {
  if (globalThis.AGate) return globalThis.AGate
  if (typeof globalThis.requireNode !== 'function') return null
  const module = globalThis.requireNode('@openarcanum/agate')
  const AGate = module.default || module
  globalThis.AGate = new AGate(getRuntimeConfig())
  return globalThis.AGate
}

// Components resolve utilities when used, after the desktop bridge is available.
export const utils = new Proxy({}, {
  get(_target, property) {
    const runtime = getAGate()
    if (!runtime) throw new Error('AGate requires the OpenArcanum desktop runtime.')
    const value = runtime.Utils[property]
    return typeof value === 'function' ? value.bind(runtime.Utils) : value
  }
})

export function getDataStatus(configuration = getRuntimeConfig(), requireNode = globalThis.requireNode) {
  const dataPath = configuration.dataPath || './local-data'
  if (typeof requireNode !== 'function') {
    return { ready: false, dataPath, message: 'Open this application in the OpenArcanum desktop runtime to access local game data.' }
  }
  const fs = requireNode('node:fs')
  const path = requireNode('node:path')
  const scriptsPath = configuration.scriptsPath || path.join(dataPath, 'scripts')
  const required = ['gui/gui-images.css', 'gui/gui-images.json']
  const missing = required.filter(name => !fs.existsSync(path.join(dataPath, name)))
  if (!fs.existsSync(path.join(scriptsPath, 'client/gui'))) missing.push(`${scriptsPath}/client/gui`)
  const archivePath = path.join(dataPath, 'archives')
  const archives = fs.existsSync(archivePath) && fs.statSync(archivePath).isDirectory()
    ? fs.readdirSync(archivePath).filter(name => name.toLowerCase().endsWith('.zip')) : []
  if (!archives.length) missing.push('archives/*.zip')
  return {
    ready: missing.length === 0,
    dataPath,
    message: missing.length
      ? `Converted data is missing: ${missing.join(', ')}.`
      : 'Converted data files were found. Their contents and campaign compatibility have not been validated.'
  }
}
