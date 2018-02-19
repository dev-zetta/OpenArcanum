import AGate from '../agate';
import {GfxTypes, GfxPathBuilder} from '../shared/assets';
import Enums from '../shared/enums';

import Phaser from '../libs/phaser';

export class Sprite {

  constructor(client) {
    this.client = client;
  }

  get stageLength() {
    return this.sprite.texture.frameTotal;
  }

  async load(data) {
    let assetLoader = this.client.engine.assetLoader;
    let dataPath = AGate.getDataPath('Gfx/2D');

    let path = '';
    if (AGate.Utils.isObject(data)) {
      let builder = new GfxPathBuilder(data);
      path = builder.toPath();

      Object.assign(this, data);

      //this.flipped = data.flipped;
      this.frame = AGate.Utils.isUndefined(data.frame) ? 0 : data.frame;
      this.type = GfxTypes.get(data.type);
    } else {
      path = data;
    }

    this.path = path;

    this.selectedVariant = 0;

    switch (this.type) {
      case GfxTypes.Tile:
        this.currentStage = 'North';
        return;
      case GfxTypes.Portal:
      case GfxTypes.Wall:
        this.currentStage =  data.stage;
        break;
      default:
        this.currentStage = AGate.Utils.isUndefined(data.stage) ? 'North' : data.stage;
        break;
    }

    let spritePath = `${dataPath}/${this.path}`;
    let meta = await assetLoader.loadJsonFile(`${spritePath}/Meta.json`);
    if (!meta)
      return;

    this.frameRate = meta.frameRate;
    this.triggerFrame = meta.triggerFrame;
    this.animated = meta.animated;

    //Object.assign(this, meta);

    /*
    "frameRate": 14,
    "stageCount": 8,
    "stageLength": 10,
    "triggerFrame": 7,
    "versionCount": 4
    */

    this.variants = [];
    this.stages = [];

    let variantPath = `${spritePath}/${this.selectedVariant}`;
    let keyPrefix = `${this.path}/${this.selectedVariant}`;

    let stageDirs = await assetLoader.findDirs(variantPath);

    for (let [key, value] of stageDirs) {
      let stageName = key; // AGate.Utils.getLastDir(dir);
      let stagePath = `${variantPath}/${stageName}`;
      let assetKey = `${keyPrefix}/${stageName}`;

      this.client.scene.loadAsset(assetKey, 'atlas', {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      });

      this.stages.push(stageName);
    }
  }

  addToScene(target, x, y, z = 0, offset = null) {
    let currentPath = `${this.path}/${this.selectedVariant}`;
    let key, frame;

    switch (this.type) {
      case GfxTypes.Tile:
        key = 'tiles';
        frame = `${currentPath}/${this.currentStage}/Sprite.gif`;
        break;
      case GfxTypes.Wall:
        key = `${currentPath}/North`;
        frame = `${key}/${this.frame}`;
        break;
      case GfxTypes.Portal:
        key = `${currentPath}/North`;
        frame = `${key}/0`;
        //this.animated = true;
        break;
      default:
        key = `${currentPath}/${this.currentStage}`;
        frame = `${key}/${this.frame}`;
        break;
    }

    this.sprite = target.scene.addIsoSprite(x, y, z, key, frame, target, offset);
    this.sprite.data = this;
    this.offset = offset;

    switch (this.type) {
      case GfxTypes.Wall:
      case GfxTypes.Portal:
        this.sprite.alpha = 0.7;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 .5;
        break;
    }

    this.sprite.setInteractive();

    if (this.flipped && this.type !== GfxTypes.Facade) {
      //this.sprite.originX = 0.5;


      this.sprite.scaleX *= -1;

      //this.sprite.flipX = true;

      this.sprite.resetIsoBounds();
    }

    if (this.animated /*this.stageLength > 1 && (this.type !== GfxTypes.Facade && this.type !== GfxTypes.Tile)*/) {
      for (let stageIndex = 0; stageIndex < this.stages.length; stageIndex++) {
        let stageName = this.stages[stageIndex];
        let stagePath = `${this.path}/${this.selectedVariant}/${stageName}`;

        // create animation
        let frames = target.scene.anims.generateFrameNames(stagePath,
          {prefix: `${stagePath}/`, end: this.stageLength - 1});

        target.scene.anims.create({
            key: stagePath,
            frames: frames,
            frameRate: this.frameRate,
            repeat: -1,

            onUpdate: (sprite, animation, params) => {
              sprite.displayOriginX = sprite.frame.centerX;
              sprite.displayOriginY = sprite.frame.centerY;
            }
        });

        // load animation
        this.sprite.anims.play(stagePath);
      }
    }

    //if (this.type == GfxTypes.Tile)
    //this.sprite.setPipeline('Light2D');

  }

  setData(data) {
    this.data = data;
  }

  setBlendMode(mode) {

    switch (mode) {
      case 'BlendAdd':
        mode = Phaser.BlendModes.ADD;
        break;
      case 'BlendMul':
        mode = Phaser.BlendModes.MULTIPLY;
        break;
      default:
        return;
    }

    this.sprite.setBlendMode(mode);
  }

  setTint(color) {
    this.sprite.setTint(color);
  }

  //  Canvas and WebGL:

  // NORMAL
  // ADD
  // MULTIPLY
  // SCREEN

  //  Canvas only:

  // OVERLAY
  // DARKEN
  // LIGHTEN
  // COLOR_DODGE
  // COLOR_BURN
  // HARD_LIGHT
  // SOFT_LIGHT
  // DIFFERENCE
  // EXCLUSION
  // HUE
  // SATURATION
  // COLOR
  // LUMINOSITY

  // image.setBlendMode(Phaser.BlendModes.OVERLAY);


}
