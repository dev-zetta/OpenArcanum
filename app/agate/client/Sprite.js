import AGate from '../agate';
import {GfxTypes, GfxPathBuilder} from '../shared/assets';
import Enums from '../shared/enums';

import Phaser from '../libs/phaser';

export class Sprite {

  constructor(client) {
    this.client = client;
  }

  async load(data) {
    let assetLoader = this.client.engine.assetLoader;
    var dataPath = AGate.getDataPath('Gfx/2D');

    var path = '';
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

    let variant = 0; //AGate.Utils.isUndefined(data.variant) ? 0 : data.variant

    this.selectedVariant = variant;

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

    let meta = await assetLoader.loadJsonFile(`${dataPath}/${this.path}/Meta.json`);
    if (!meta)
      return;

    Object.assign(this, meta);

    /*
    "frameRate": 14,
    "stageCount": 8,
    "stageLength": 10,
    "triggerFrame": 7,
    "versionCount": 4
    */

    this.variants = [];
    this.stages = [];

    let stageDirs = await assetLoader.findDirs(`${dataPath}/${this.path}/${variant}/`);

    stageDirs.forEach((dir) => {
      let stageName = AGate.Utils.getLastDir(dir);
      let key = `${this.path}/${variant}/${stageName}`;

      //AGate.Utils.logError(`${dir}/Sprite.${AGate.Const.Sprite.DefaultExt}`)

      //let urlPath = `${dataUrl}/${path}`
      //if (AGate.Utils.isFileExist(`${urlPath}/Stage.json`))

      this.client.scene.loadAsset(key, 'atlas', {
        texture: `${dir}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${dir}/Stage.json`,
        flippedX: this.flipped
      });

      this.stages.push(stageName);
    });
  }

  addToScene(target, x, y, z = 0, offset = null) {
    var currentPath = `${this.path}/${this.selectedVariant}`;
    var key, frame;

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
        break;
      default:
        key = `${currentPath}/${this.currentStage}`;
        frame = `${key}/${this.frame}`;
        break;
    }

    if (this.flipped && this.type != GfxTypes.Tile) {
      frame += `/Flipped`;
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

    //let delta = this.sprite.frame.delta;

    /*if (delta) {
      this.sprite.x -= delta.x;
      this.sprite.y -= delta.y;
    }*/

    /*if (offset != null) {

      this.sprite.x = this.sprite.x + offset.x;
      this.sprite.y = this.sprite.y + offset.y;
    }*/

    //this.sprite.checkWorldBounds = false
    //this.sprite.autoCull = true
    this.sprite.setInteractive();

    //this.sprite.originY = 1.0;

    if (this.flipped && this.type !== GfxTypes.Facade) {
      //this.sprite.originX = 0.5;


      //this.sprite.scaleX *= -1;
      this.sprite.flipX = true;
    }

    if (this.stageLength > 1 && this.type !== GfxTypes.Facade) {
      for (let stageIndex = 0; stageIndex < this.stages.length; stageIndex++) {
        let stageName = this.stages[stageIndex];
        let stagePath = `${this.path}/${this.selectedVariant}/${stageName}`;

        // create animation
        let frames = target.scene.anims.generateFrameNames(stagePath,
          {prefix: `${stagePath}/`, end: this.stageLength - 1});

        target.scene.anims.create(
          {key: stagePath, frames: frames, frameRate: this.frameRate, repeat: -1});

        // load animation
        this.sprite.anims.load(stagePath);
      }
    }

    //this.sprite.setPipeline('Light2D');

  }

  setData(data) {
    this.data = data;
  }

  setBlendMode(mode) {
    this.sprite.setBlendMode(Phaser.BlendModes.ADD);
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
