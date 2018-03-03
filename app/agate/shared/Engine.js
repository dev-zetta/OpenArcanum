/* global AGate */
import {Client} from '../client/Client';
import {GameMap} from './map/GameMap';
import {AssetLoader} from './assets';
import {WorkerPool} from './misc/WorkerPool';
import {EventEmitter} from './misc/EventEmitter';

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

  /**
   *
   * @param canvas
   * @returns {Promise<void>}
   */
  async createClient(canvas) {
    await this.assetLoader.initialize();

    this.client = new Client(this, canvas);

    await this.client.create();
  }

  /**
   *
   */
  update() {
    this.map.update();
  }

  /**
   *
   */
  load() {
    let path = AGate.getDataPath('Bates Mansion Lev 2');
    this.map.load(path);
  }

  /**
   *
   */
  onPreloaded() {
    this.load();
  }

  /**
   *
   * @param map
   */
  onMapLoading(map) {
    this.client.onMapLoading(map);
  }

  /**
   *
   * @param map
   */
  onMapLoaded(map) {
    this.client.onMapLoaded(map);
  }

}

Engine.instance = new Engine();


