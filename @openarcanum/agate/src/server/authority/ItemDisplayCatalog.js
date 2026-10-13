import fs from 'node:fs/promises'
import path from 'node:path'

export const MAX_ITEM_LABEL_LENGTH = 128
export const MAX_ITEM_DISPLAY_ROWS = 10000
export const MAX_ITEM_DISPLAY_BYTES = 1024 * 1024

function descriptionId(value) {
  if (typeof value === 'string') {
    if (!/^(0|[1-9][0-9]*)$/.test(value)) return null
    value = Number(value)
  }
  return Number.isSafeInteger(value) && value >= 0 && value < 30000 ? value : null
}

/** An immutable, host-local presentation catalog; it never supplies rules. */
export default class ItemDisplayCatalog {
  #labels

  constructor(data) {
    const labels = new Map(), seen = new Set()
    try {
      const table = data?.Description
      let rows
      if (Array.isArray(table)) rows = table
      else if (table && typeof table === 'object') {
        const keys = Object.keys(table)
        if (keys.length <= MAX_ITEM_DISPLAY_ROWS && keys.every(key => /^(0|[1-9][0-9]*)$/.test(key))) {
          rows = keys.map(key => table[key])
        }
      }
      if (rows && rows.length <= MAX_ITEM_DISPLAY_ROWS) {
        for (const row of rows) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) continue
          const id = descriptionId(row.id)
          if (id === null) continue
          // Even a malformed duplicate makes this ID ambiguous. Never let
          // ordinal order select a different name for the same content key.
          if (seen.has(id)) { labels.delete(id); continue }
          seen.add(id)
          if (typeof row.text !== 'string' || row.text.length > MAX_ITEM_LABEL_LENGTH ||
              !row.text.trim() || /[\x00-\x1f\x7f]/.test(row.text)) continue
          labels.set(id, row.text.trim())
        }
      }
    } catch { labels.clear() }
    this.#labels = labels
    Object.freeze(this)
  }

  labelFor(entity, fallback = 'Item') {
    try {
      // Keys use gamekey.mes before the ordinary description path in
      // arcanum-ce object_examine (0x441B60). Keyrings remain conservative.
      if (['Key', 'KeyRing', 'Keyring'].includes(entity?.base?.type)) return fallback
      const item = entity?.item
      if (!item) return fallback
      // arcanum-ce item_is_identified (0x464370): nonmagical/technological
      // complexity <= 0, or the explicit Identified flag. Missing converted
      // complexity is unknown here, rather than an invented zero default.
      const identified = (Number.isSafeInteger(item.magicTechComplexity) && item.magicTechComplexity <= 0) ||
        item.flags?.has?.('Identified') === true
      const id = descriptionId(identified ? entity.base?.descIndex : item.descriptionUnknown)
      // Never use a known name as a fallback for a missing unknown name.
      return id === null ? fallback : this.#labels.get(id) || fallback
    } catch { return fallback }
  }
}

/** Optional loose system text, loaded independently of simulation identity. */
export async function loadItemDisplayCatalog(dataPath) {
  let handle
  try {
    handle = await fs.open(path.join(dataPath, 'mes', 'Description.json'), 'r')
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > MAX_ITEM_DISPLAY_BYTES) return new ItemDisplayCatalog()
    // Bound the actual read too, in case the file grows after stat().
    const bytes = Buffer.alloc(MAX_ITEM_DISPLAY_BYTES + 1)
    let length = 0
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, length)
      if (!read.bytesRead) break
      length += read.bytesRead
    }
    if (length > MAX_ITEM_DISPLAY_BYTES) return new ItemDisplayCatalog()
    const data = JSON.parse(bytes.toString('utf8', 0, length).replace(/^\uFEFF/, ''))
    return new ItemDisplayCatalog(data)
  } catch { return new ItemDisplayCatalog() }
  finally { await handle?.close().catch(() => {}) }
}
