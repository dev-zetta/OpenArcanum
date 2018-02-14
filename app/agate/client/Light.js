import Phaser from '../libs/phaser';

export class Light {
  constructor() {

  }

  addToScene(scene, x, y, color) {
    this.scene = scene;

    this.instance = this.scene.lights.addLight(x, y, 40.0);

    this.instance.setColor(color);
  }

}
