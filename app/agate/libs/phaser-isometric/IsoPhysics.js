import { World } from './physics/World'
import { Body } from './physics/Body'
import { Factory } from './physics/Factory'

export class IsoPhysics {
  constructor(physicsManager, config) {
    this.config = config
    this.physicsManager = physicsManager

    physicsManager.world = new World(physicsManager.scene, config)
    physicsManager.add = new Factory(physicsManager.world)
  }

  /*parseConfig() {
        if (this.config.hasOwnProperty('isoArcade') && this.config['isoArcade'] === true && hasOwnProperty('IsoArcade')) {
            this.isoArcade = new Isometric(this.game, this.config);
        }
    }

    startSystem (system) {
        if (system === Isometric.ISOARCADE && this.isoArcade === null) {
            this.isoArcade = new Arcade(this.game);
            this.setBoundsToWorld();
        }
    }

    enable(sprite, system) {
        if (system === Isometric.ISOARCADE && this.isoArcade) {
            this.isoArcade.enable(sprite);
        }
    }*/

  setBoundsToWorld() {
    this.physicsManager.world.setBoundsToWorld()
  }

  destroy() {
    this.physicsManager.world = null

    //return super.destroy();
  }
}
