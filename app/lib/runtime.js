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
  const mapId = configuration.developmentMap || 'Bates Mansion Lev 2'
  const required = ['gui/gui-images.css', 'gui/gui-images.json', '16086.json']
  const missing = required.filter(name => !fs.existsSync(path.join(dataPath, name)))
  if (!fs.existsSync(path.join(scriptsPath, 'client/gui'))) missing.push(`${scriptsPath}/client/gui`)
  const archivePath = path.join(dataPath, 'archives')
  const archives = fs.existsSync(archivePath) && fs.statSync(archivePath).isDirectory()
    ? fs.readdirSync(archivePath).filter(name => name.toLowerCase().endsWith('.zip')) : []
  const archiveNames = new Set(archives.map(name => name.toLowerCase()))
  for (const name of ['Prototypes.zip', 'Gfx.zip', 'Gfx-tiles.zip', `${mapId}.zip`]) {
    if (!archiveNames.has(name.toLowerCase())) missing.push(`archives/${name}`)
  }
  return {
    ready: missing.length === 0,
    dataPath,
    mapId,
    message: missing.length
      ? `Converted data is missing: ${missing.join(', ')}.`
      : 'Converted files for the local map checkpoint were found. Their contents and campaign compatibility have not been validated.'
  }
}

// GUI sprite metadata supplies frame geometry; the adjacent stylesheet holds
// the original converted images. Load both before showing authored widgets.
export function loadGuiStylesheet(url, document = globalThis.document) {
  const existing = document.querySelector('link[data-arcanum-gui-assets]')
  if (existing?.href === url && existing.ready) return existing.ready
  existing?.remove()
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.dataset.arcanumGuiAssets = 'true'
  link.ready = new Promise((resolve, reject) => {
    link.addEventListener('load', () => resolve(link), { once: true })
    link.addEventListener('error', () => {
      link.remove()
      reject(new Error('The converted GUI image stylesheet could not be loaded.'))
    }, { once: true })
  })
  document.head.append(link)
  return link.ready
}
