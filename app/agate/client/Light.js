import Phaser from '../libs/phaser';

export class Light {
  constructor() {

  }

  addToScene(scene, x, y) {
    this.scene = scene;

    this.scene.lights.addLight(x, y, 100.0, 0xff0000);
  }

}
