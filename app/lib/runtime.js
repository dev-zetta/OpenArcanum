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
  const moduleId = configuration.moduleId
  const ownedModule = moduleId === 'inventory-workshop'
  if (moduleId && !ownedModule) {
    return { ready: false, dataPath, moduleId, ownedModule: false, message: `Unknown bundled module: ${moduleId}.` }
  }
  if (typeof requireNode !== 'function') {
    return { ready: false, dataPath, ownedModule,
      message: ownedModule ? 'Open the inventory workshop in the OpenArcanum desktop runtime.' :
        'Open this application in the OpenArcanum desktop runtime to access local game data.' }
  }
  const fs = requireNode('node:fs')
  const path = requireNode('node:path')
  if (ownedModule) return getWorkshopStatus(configuration, fs, path)
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

// Only the explicitly selected bundled workshop uses this metadata. The
// manifest describes asset files; it cannot select paths, modules or scripts.
function getWorkshopStatus(configuration, fs, path) {
  const dataPath = configuration.dataPath
  const mapId = 'Inventory workshop'
  const status = { dataPath, mapId, moduleId: 'inventory-workshop', ownedModule: true }
  const manifestPath = configuration.moduleManifestPath
  const required = ['16086.json', `${mapId}/Map.json`, `${mapId}/Sector/0/0/Sector.json`,
    'Prototypes/Pc/900001.json', 'Prototypes/Container/900002.json', 'Prototypes/Generic/900003.json',
    'Prototypes/Portal/900004.json', `${mapId}/Sector/0/0/Container/owned-workshop-box.json`,
    `${mapId}/Sector/0/0/Generic/owned-workshop-token.json`, `${mapId}/Sector/0/0/Portal/owned-workshop-door.json`,
    'Gfx/2D/Tile/tiles.json', 'Gfx/2D/Tile/tiles.png',
    'Gfx/2D/Container/Workshop/Box/Meta.json', 'Gfx/2D/Container/Workshop/Box/0/North/Stage.json',
    'Gfx/2D/Container/Workshop/Box/0/North/Sprite.png',
    'Gfx/2D/Portal/Door/Workshop/0/Meta.json', 'Gfx/2D/Portal/Door/Workshop/0/0/North/Stage.json',
    'Gfx/2D/Portal/Door/Workshop/0/0/North/Sprite.png',
    ...['Stand', 'Walk'].flatMap(animation => {
      const base = `Gfx/2D/Critter/Workshop/Male/Coat/None/Unarmed/${animation}`
      return [`${base}/Meta.json`, `${base}/0/South/Stage.json`, `${base}/0/South/Sprite.png`]
    }),
    'archives/Prototypes.zip', `archives/${mapId}.zip`, 'archives/Gfx.zip']
  let manifest
  try {
    if (typeof dataPath !== 'string' || !dataPath || configuration.developmentMap !== mapId ||
        typeof manifestPath !== 'string' || !manifestPath || !fs.existsSync(manifestPath)) throw new Error('missing configuration')
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    if (!manifest || manifest.format !== 'openarcanum-owned-module' || manifest.version !== 1 ||
        manifest.id !== 'inventory-workshop' || manifest.mapId !== mapId || manifest.data !== 'data' ||
        !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 512 ||
        manifest.files.some(name => typeof name !== 'string' || /[:\\\x00-\x1f]/.test(name) ||
          name.split('/').some(part => !part || part === '.' || part === '..') ||
          !/\.(?:json|png|gif|zip)$/.test(name)) || new Set(manifest.files).size !== manifest.files.length ||
        required.some(name => !manifest.files.includes(name))) {
      throw new Error('invalid manifest')
    }
  } catch {
    return { ...status, ready: false, message: 'The bundled inventory workshop manifest is missing or invalid.' }
  }
  const missing = manifest.files.filter(name => !fs.existsSync(path.join(dataPath, name)))
  return { ...status, ready: missing.length === 0,
    message: missing.length ? `Bundled workshop files are missing: ${missing.join(', ')}.` :
      'The bundled inventory workshop is ready. No original game data is required.' }
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
