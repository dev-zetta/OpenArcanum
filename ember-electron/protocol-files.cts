import fs from 'node:fs'
import path from 'node:path'

export interface ProtocolFileOptions {
  scheme?: string
  host?: string
  index?: boolean
  caseInsensitive?: boolean
}

export function containedPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

// The asset URL's host is the first directory: asset://gfx/2D/Interface/...
// Resolve only inside the selected root, including when it contains symlinks.
export function resolveProtocolFile(root: string, rawUrl: string, { scheme, host, index = false, caseInsensitive = false }: ProtocolFileOptions = {}): string | null {
  const url = new URL(rawUrl)
  if (url.protocol !== `${scheme}:` || url.username || url.password || url.port) {
    throw new Error('Invalid local protocol URL')
  }
  if (host && url.hostname !== host) throw new Error('Unknown application host')

  const pathname = decodeURIComponent(url.pathname)
  const hostname = host ? '' : decodeURIComponent(url.hostname)
  if (pathname.includes('\\') || hostname.includes('\\') || pathname.includes('\0') || hostname.includes('\0')) {
    throw new Error('Invalid local protocol path')
  }
  const segments = `${hostname}/${pathname}`.split('/').filter(Boolean)
  if (segments.some(segment => segment === '.' || segment === '..')) throw new Error('Invalid local protocol path')

  let candidate = path.resolve(root, ...segments)
  if (!containedPath(path.resolve(root), candidate)) throw new Error('Path outside local root')
  // Ember's history routes fall back to index.html; missing scripts/assets do not.
  if (index && (segments.length === 0 || (!path.extname(candidate) && !fs.existsSync(candidate)))) {
    candidate = path.join(root, 'index.html')
  }
  // Chromium normalizes a standard URL's host to lowercase, while converted
  // Windows assets can contain Gfx/2D and other mixed-case directory names.
  // Prefer an exact path, then resolve an unambiguous case-insensitive match.
  if (caseInsensitive && !fs.existsSync(candidate) && fs.existsSync(root)) {
    let directory = path.resolve(root)
    const realRoot = fs.realpathSync(root)
    for (const segment of segments) {
      if (!containedPath(realRoot, fs.realpathSync(directory))) throw new Error('Symlink outside local root')
      const exact = path.join(directory, segment)
      if (fs.existsSync(exact)) {
        directory = exact
        continue
      }
      if (!fs.statSync(directory).isDirectory()) return null
      const matches = fs.readdirSync(directory).filter(entry => entry.toLowerCase() === segment.toLowerCase())
      if (matches.length === 0) return null
      if (matches.length > 1) throw new Error('Ambiguous local asset filename')
      directory = path.join(directory, matches[0])
    }
    candidate = directory
  }
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null

  const realRoot = fs.realpathSync(root)
  const realFile = fs.realpathSync(candidate)
  if (!containedPath(realRoot, realFile)) throw new Error('Symlink outside local root')
  return candidate
}

