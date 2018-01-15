import AGate from '../agate'
import { EntitySystem } from './EntitySystem'
import { Sprite } from '../client/Sprite'

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
        this.entities = [];

        entityTypes.forEach((entityDir, iIndex, array1) => {

            let entityFiles = AGate.Utils.findFiles(`${entityDir}/`, '.json')

            entityFiles.forEach((entityFile, iIndex, array1) => {
                this.entities.push(
                    this.loadEntity(entityFile)
                )
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

        return entity
    }

    placeToScene(target) {
        this.tileGroup = new Phaser.GameObjects.Group(target.scene)
        target.add(this.tileGroup)

        this.tiles.forEach((col, colIndex, array1) => {
            var y = colIndex * (Sector.TileWidth / 2)

            col.forEach((row, rowIndex, array1) => {
                let x = rowIndex * Sector.TileHeight
                //let screen = row.location.worldToScreen()
                row.sprite.addToScene(this.tileGroup, y, x)
                row.entities = [];
            })
        })

        this.staticGroup = new Phaser.GameObjects.Group(target.scene)
        target.add(this.staticGroup)

        this.entities.forEach((entity, iIndex, array1) => {
            let baseComponent = entity.components['Base']
            let position = baseComponent.location.tile

            this.tiles[position.y][position.x].entities.push(entity)

            let visualComponent = entity.components['Visual']
            if (visualComponent) {
                let visualClass = visualComponent.classes['Current']

                let offset = baseComponent.offser
                let sprite = visualClass.sprite
                let y = (position.x * (Sector.TileWidth / 2))
                let x = (position.y * Sector.TileHeight)

                /*if (sprite.type == 'Wall' || sprite.type == 'Portal') {
                    switch (sprite.currentStage) // Counter clockwise
                    {
                        case 0:
                            // Unknown
                            break
                        case 1:
                            // South east, indoor (Up right)
                            x -= 20 //(Sector.TileWidth / 2) - 1
                            y += 39 //(Sector.TileHeight / 2)
                            break
                        case 2:
                            // Unknown
                            break
                        case 3:
                            // South west, outdoor
                            //x -= 20
                            //y -= 20
                            return
                            break
                        case 4:
                            // Unknown
                            break
                        case 5:
                            // South east, outdoor (Down left)
                            //x += 20
                            //y += 20
                            return
                            break
                        case 6:
                            // Unknown
                            return
                            break
                        case 7:
                            // South west, indoor (Up left)
                            x -= 19 //(Sector.TileWidth / 2) + 1
                            y -= 20 //(Sector.TileHeight / 2)
                            return
                            break
                    }
                }*/


                sprite.addToScene(this.staticGroup, x + offset.x, y + offset.y, 64 - position.y)
            }
        })


    }

    update() {
        var self = this;
        // Loop through all tiles and test to see if the 3D position from above intersects with the automatically generated IsoSprite tile bounds.
        var cursorPos = this.engine.client.scene.cursorPos

        if (!AGate.Utils.isUndefined(this.staticGroup)) {

            this.tileGroup.getChildren().forEach(function (tile) {
                var inBounds = tile.isoBounds.containsXY(cursorPos.x, cursorPos.y);
                // If it does, do a little animation and tint change.
                if (!tile.selected && inBounds) {
                    tile.selected = true;
                    tile.tint = 0x86bfda;
                    //self.add.tween(tile).to({ isoZ: 4 }, 200, Phaser.Easing.Quadratic.InOut, true);
                }
                // If not, revert back to how it was.
                else if (tile.selected && !inBounds) {
                    tile.selected = false;
                    tile.tint = 0xffffff;
                    //self.add.tween(tile).to({ isoZ: 0 }, 200, Phaser.Easing.Quadratic.InOut, true);
                }
            });
        }
    }

}

export class GameMap {

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

        for (let col = 0; col < this.height; col++) {
            for (let row = 0; row < this.width; row++) {
                if (row == 1 && col == 1)
                this.sectors[col][row].placeToScene(this.rootGroup)
            }
        }
    }

    update() {
        for (let col = 0; col < this.height; col++) {
            for (let row = 0; row < this.width; row++) {
                if (row == 1 && col == 1)
                this.sectors[col][row].update()
            }
        }

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
