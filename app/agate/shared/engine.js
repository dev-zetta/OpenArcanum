import AGate from '../agate'
import Client from '../client/client'
import GameMap from './game-map'

class Engine {
    constructor(canvas) {
        this.map = new GameMap(this)
        this.client = new Client(this, canvas)
    }

    update() {
        this.map.update()
    }

    load() {
        let path = AGate.getDataPath('map')
        this.map.load(path)
    }

    onMapLoading(map) {
        this.client.onMapLoading(map)
    }

    onMapLoaded(map) {
        this.client.onMapLoaded(map)
    }

}

export default Engine
