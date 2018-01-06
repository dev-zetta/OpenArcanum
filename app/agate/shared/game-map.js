import AGate from '../agate'
import EntitySystem from './entity-system'
import Sprite from '../client/sprite'

export class Location {

    constructor(x, y) {
        this.x = x
        this.y = y
    }

    worldToScreen() {
        let x = ((this.x - this.y) * (Sector.TileWidth / 2))
        let y = ((this.x + this.y) * (Sector.TileHeight / 2))

        return new Location(x, y)
    }

    getSectorX() {
    	return (this.x / Sector.Width)
    }

    getSectorY() {
    	return (this.y / Sector.Height)
    }

    getTileX() {
    	return (this.x % Sector.Width)
    }

    getTileY() {
    	return (this.y % Sector.Height)
    }

}


export class Sector {
    static get TileWidth() { return 80 }
    static get TileHeight() { return 40 }

    static get Width() { return 64 }
    static get Height() { return 64 }

    constructor(map) {
        this.map = map
        this.engine = map.engine
    }

    load(path, x, y) {
        AGate.Utils.logError(`Loading sector: ${path}`)

        let data = AGate.Utils.loadJson(`${path}/Sector.json`)

        this.x = x
        this.y = y
        this.tiles = data.tiles
        this.lights = data.lights
        this.roofs = data.roofs

        this.tiles.forEach((col, colIndex, array1) => {
            col.forEach((row, rowIndex, array1) => {
                row.location = new Location(x * Sector.Width + rowIndex, y * Sector.Height + colIndex)

                if (this.engine.client) {
                    row.sprite = new Sprite(this.engine.client)

                    row.sprite.load(row)
                }
            })
        })

        this.loadEntities(path)
    }

    loadEntities(path) {
        let entityTypes = AGate.Utils.findDirs(`${path}/`)

        entityTypes.forEach((entityDir, iIndex, array1) => {

            let entityFiles = AGate.Utils.findFiles(`${entityDir}/`, '.json')

            entityFiles.forEach((entityFile, iIndex, array1) => {
                this.loadEntity(entityFile)
            })
        })
    }

    loadEntity(path) {
        AGate.Utils.logError(`Loading entity: ${path}`)

        let data = AGate.Utils.loadJson(`${path}`)
        let entity = this.map.entitySystem.newEntity(data)

        if (this.engine.client) {
            let visualComponent = entity.components['Visual']
            if (visualComponent) {
                let visualClasses = visualComponent.classes

                for (let className in visualClasses) {
                    let visualClass = visualClasses[className]

                    let sprite = new Sprite(this.engine.client)

                    sprite.load(visualClass)
                    visualClass.sprite = sprite
                }

            }


        }
    }

    placeToScene(target) {

        this.tiles.forEach((col, colIndex, array1) => {
            col.forEach((row, rowIndex, array1) => {

                let screen = row.location.worldToScreen()
                row.sprite.addToScene(target, screen.x, screen.y)
            })
        })
    }


}

export default class GameMap {

    constructor(engine) {
        this.engine = engine
        this.entitySystem = new EntitySystem(engine)
        this.isLoaded = false;
    }

    load(path) {
        this.path = path
        this.name = ''
        this.isLoading = true;
        this.isLoaded = false;

        AGate.Utils.logError(`Loading map: ${path}`)
        AGate.Utils.loadJson(`${path}/Map.json`, (data) => {
            this.width = data.width
            this.height = data.height
            this.sectors = []

            for (let col = 0; col < this.height; col++) {
                this.sectors[col] = []
                for (let row = 0; row < this.width; row++) {
                    let sector = new Sector(this)

                    if (row == 1 && col == 1)
                    sector.load(this.getSectorPath(col, row), col, row)

                    this.sectors[col][row] = sector
                }
            }

            this.engine.onMapLoading(this)
            this.isLoading = false
        })
    }

    placeToScene(target) {
        AGate.Utils.logError(`Placing to scene: ${this.path}`)

        this.rootGroup = target.add.group()
        this.rootGroup.autoCull = true

        this.tileGroup = target.add.group() //new Phaser.GameObjects.Group(target, this.rootGroup)
        //this.rootGroup.add(this.tileGroup)

        for (let col = 0; col < this.height; col++) {
            for (let row = 0; row < this.width; row++) {
                if (row == 1 && col == 1)
                this.sectors[col][row].placeToScene(this.tileGroup)
            }
        }
    }

    update() {
        /*if (!this.isLoaded && !AGate.Utils.isUndefined(this.path)) {
            this.isLoaded = !this.engine.client.game.load.isLoading

            if (this.isLoaded)
                this.engine.onMapLoaded(this)
        }*/

        //this.ecs.update()

    }

    getSectorPath(x, y) {
        return `${this.path}/Sector/${x}/${y}`
    }
}
