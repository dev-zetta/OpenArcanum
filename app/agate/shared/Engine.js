import AGate from '../agate';
import {Client} from '../client/Client';
import {GameMap} from './GameMap';
import {AssetLoader} from './assets';
import {WorkerPool} from './WorkerPool';
import {EventEmitter} from './EventEmitter';

export class Engine {

  constructor() {
    //super();

    this.events = new EventEmitter();
    this.workerPool = new WorkerPool(this);
    this.assetLoader = new AssetLoader(this);
    this.map = new GameMap(this);

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

  async createClient(canvas) {
    this.client = new Client(this, canvas);

    await this.client.create();
  }

  update() {
    this.map.update();
  }

  load() {
    let path = AGate.getDataPath('map2');
    //this.map.load(path);
  }

  onPreloaded() {
    this.load();
  }

  onMapLoading(map) {
    this.client.onMapLoading(map);
  }

  onMapLoaded(map) {
    this.client.onMapLoaded(map);
  }

}

Engine.instance = new Engine();


