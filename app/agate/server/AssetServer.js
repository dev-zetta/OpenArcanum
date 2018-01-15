import AGate from '../agate'

var http = AGate.requireNode('http')
var url = AGate.requireNode('url')
var querystring = AGate.requireNode('querystring')
var fs = AGate.requireNode('fs')
var mime = AGate.requireNode('mime-types')

export class AssetServer {

    constructor() {

    }

    start(path, port = 7000) {
        this.path = path
        this.port = port

        this.server = http.createServer(function(request, response) {
            var pathName = url.parse(request.url).pathname
            var absPath = `${path}${pathName}`

            fs.readFile(absPath, function(err, data) {

                //AGate.Utils.logError(mime.lookup(absPath))
                if (err) {
                   response.writeHead(404, {'Content-type':'text/plain'})
                   response.write('Page Was Not Found')
                   response.end( )
                } else {

                   response.writeHead(200, {'Content-type': mime.lookup(absPath)})
                   response.write(data)
                   response.end( )
                }
            })
        })

        this.server.listen(this.port)
    }
}
