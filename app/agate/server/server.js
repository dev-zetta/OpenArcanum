const WebSocket = require('ws');

class GameServer {
    create(port = 8080) {
        this.wss = new WebSocket.Server({ port: port });

        this.wss.on('connection', function connection(ws) {
            ws.on('message', function incoming(message) {
                console.log('received: %s', message);
            });

            ws.send('something');
        });
    }

}
