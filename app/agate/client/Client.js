import AGate from '../agate';
import Phaser from '../libs/phaser';

/*
import Boot from './states/boot'
import Game from './states/game'
import Menu from './states/menu'
import Preloader from './states/preloader'
import Gameover from './states/gameover'
*/

import {AssetServer} from '../server/AssetServer';
import {Scene} from './Scene';

export class Client {
  constructor(engine, canvas) {
    //super({ key: 'BootScene' })

    this.engine = engine;
    this._canvas = canvas;
    this.assetServer = new AssetServer();
    this.assetServer.start(AGate.getDataPath());

    let self = this;
    this.game = new Phaser.Game({
      parent: canvas,
      renderer: Phaser.WEBGL,
      transparent: true,
      //antialias: true,
      multiTexture: false,
      enableDebug: false,
    });

    this.scene = new Scene(this);
    this.game.scene.add('default', this.scene);
    this.game.scene.start('default');

    /*game.state.add('boot', new Boot())
    game.state.add('game', new Game())
    game.state.add('menu', new Menu())
    game.state.add('preloader', new Preloader())
    game.state.add('gameover', new Gameover())*/
  }

  get canvas() {
    return this._canvas;
  }

  onMapLoading(map) {
    this.scene.onMapLoading(map);
  }

  onMapLoaded(map) {
    this.scene.onMapLoaded(map);
    map.placeToScene(this.scene);
  }

}
