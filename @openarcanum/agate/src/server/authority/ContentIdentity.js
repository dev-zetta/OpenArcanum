import { createHash } from 'node:crypto'
import path from 'node:path'

export const CHECKPOINT_RULES_VERSION = 'movement-doors-ownership-attributes-v9'

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

// Fingerprint the JSON the authority actually loads, including loose overlays
// and the player template. Texture archives and ZIP timestamps do not affect
// this identity. Capture before legacy prototype loading mutates raw objects.
export function captureContentIdentity(loader, { dataPath } = {}) {
  const original = loader.loadJsonFile
  const root = dataPath === undefined ? null : path.resolve(dataPath)
  const records = new Map()
  let pending = 0
  let finished = false
  const digest = mapId => {
    const hash = createHash('sha256')
    hash.update(JSON.stringify(['openarcanum-content-v1', CHECKPOINT_RULES_VERSION, mapId]))
    for (const entry of [...records].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) hash.update(JSON.stringify(entry))
    return hash.digest('hex')
  }
  const wrapped = async function (filename, ...args) {
    pending++
    try {
      const data = await original.call(this, filename, ...args)
      let name = String(filename)
      if (root && path.isAbsolute(name)) {
        name = path.relative(root, name)
        if (name === '..' || name.startsWith(`..${path.sep}`) || path.isAbsolute(name)) {
          throw new Error('Converted JSON resolved outside the authoritative data root')
        }
      }
      const key = name.replaceAll('\\', '/').replace(/^\.\//, '')
      const encoded = JSON.stringify(data === undefined ? { missing: true } : { data: canonical(data) })
      if (records.has(key) && records.get(key) !== encoded) {
        throw new Error('Converted content changed while loading the authoritative world')
      }
      records.set(key, encoded)
      return data
    } finally { pending-- }
  }
  loader.loadJsonFile = wrapped
  return {
    finish(mapId) {
      if (finished || pending || !records.size || typeof mapId !== 'string' || !mapId) {
        throw new Error('Authoritative content identity is not ready')
      }
      finished = true
      if (loader.loadJsonFile === wrapped) loader.loadJsonFile = original
      return digest(mapId)
    }
  }
}
