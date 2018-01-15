import AGate from '../agate'
import { Client } from '../client/Client'
import { GameMap } from './GameMap'

export class Engine  {
    constructor(canvas) {
        //super()
        this.map = new GameMap(this)
        this.client = new Client(this, canvas)

        /*$ige.route('app', {
            controller: Client0,
            sceneGraph: Scene0,
            textures: Textures0
        });

        // Create the HTML canvas
        ige.createFrontBuffer(canvas, true);

        // Start the engine
        ige.start(function (success) {
            // Check if the engine started successfully
            if (success) {
                //ige.addComponent(IgeEditorComponent);
                //ige.editor.showStats();

                // Navigate to the app's main route
                $ige.go('app');
            }
        });*/
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
