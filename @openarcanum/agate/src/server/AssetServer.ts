import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import mime from 'mime-types'
/** Dormant standalone asset host; the desktop uses its contained asset protocol. */
export class AssetServer {
  declare path: string
  declare port: number
  declare server: http.Server
  start(root: string, port = 7000): void {
    this.path = path.resolve(root)
    this.port = port
    this.server = http.createServer((request, response) => {
      let filename: string
      try {
        const url = new URL(request.url || '/', 'http://localhost')
        filename = path.resolve(this.path, '.' + decodeURIComponent(url.pathname))
        const relative = path.relative(this.path, filename)
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Outside asset root')
      } catch { response.writeHead(403); response.end('Invalid asset path'); return }
      fs.readFile(filename, (error, data) => {
        if (error) { response.writeHead(404, {'Content-Type': 'text/plain'}); response.end('Page Was Not Found') }
        else { response.writeHead(200, {'Content-Type': mime.lookup(filename) || 'application/octet-stream'}); response.end(data) }
      })
    })
    this.server.listen(port)
  }
}
