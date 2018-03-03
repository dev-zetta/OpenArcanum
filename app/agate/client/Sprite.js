/* global AGate */
import {GfxTypes, GfxPathBuilder} from '../shared/assets';
import Enums from '../shared/enums';

import Phaser from '../libs/phaser';
import {Math} from '../shared/misc/Math';

export class Sprite {

  constructor(client) {
    this.client = client;
    this.totalElapsed = 0;
  }

  /**
   *
   * @returns {integer}
   */
  get stageLength() {
    return this.sprite.texture.frameTotal;
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async load(data) {
    //console.log(data)

    let assetLoader = this.client.engine.assetLoader;
    let dataPath = AGate.getDataPath('Gfx/2D');

    let path = '';
    if (AGate.Utils.isObject(data)) {
      Object.assign(this, data);

      this.frame = AGate.Utils.isUndefined(data.frame) ? 0 : data.frame;

      if (!AGate.Utils.isUndefined(data.type))
        this.type = GfxTypes.get(data.type);

      let builder = new GfxPathBuilder(this);
      path = builder.toPath();
    } else {
      path = data;
    }

    this.path = path;
    this.selectedVariant = 0;

    switch (this.type) {
      case GfxTypes.Tile:
        this.currentStage = 'North';
        return;
      default:
        if (!AGate.Utils.isUndefined(data.stage)) {
          this.currentStage = data.stage;
        }

        if (!this.currentStage) {
          this.currentStage =  'North';
        }

        break;
    }

    let spritePath = `${dataPath}/${this.path}`;
    //console.log(`Loading: ${spritePath}`);

    let meta = await assetLoader.loadJsonFile(`${spritePath}/Meta.json`);
    if (!meta) {
      console.log(`Unable to load sprite: ${`${spritePath}/Meta.json`}`);
      return;
    }

    this.frameRate = meta.frameRate;
    this.triggerFrame = meta.triggerFrame;
    this.animated = meta.animated;

    //Object.assign(this, meta);

    this.variants = [];
    this.stages = [];

    let variantPath = `${spritePath}/${this.selectedVariant}`;
    let keyPrefix = `${this.path}/${this.selectedVariant}`;

    let stageDirs = await assetLoader.findDirs(variantPath);

    let promises = [];

    for (let [key, value] of stageDirs) {
      let stageName = key; // AGate.Utils.getLastDir(dir);
      let stagePath = `${variantPath}/${stageName}`;
      let assetKey = `${keyPrefix}/${stageName}`;

      let promise = this.client.scene.loadAsset(assetKey, 'atlas', {
        texture: `${stagePath}/Sprite.${AGate.Const.Sprite.DefaultExt}`,
        data: `${stagePath}/Stage.json`,
        flippedX: this.flipped
      });

      promises.push(promise);

      this.stages.push(stageName);
    }

    await Promise.all(promises);

  }

  makeTextureInfo() {
    let frame, key;
    let currentPath = `${this.path}/${this.selectedVariant}`;

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

    return { key, frame };
  }

  addToScene(target, x, y, z = 0, offset = null) {

    let {key, frame} = this.makeTextureInfo();

    //if (this.type == GfxTypes.Tile)
    //  console.log(offset);

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

    /*if (this.animated) {
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
    }*/

    //if (this.type == GfxTypes.Tile)
    //this.sprite.setPipeline('Light2D');
  }

  setData(data) {
    this.data = data;
  }

  setFrame(index) {
    let sprite = this.sprite;
    let texture = sprite.texture;

    // Generate key name
    let key = texture.firstFrame;
    key = key.substring(0, key.lastIndexOf('/'));
    key = `${key}/${index}`;

    //sprite.frame = sprite.texture.frames[key];

    sprite.setFrame(key);

    sprite.displayOriginX = sprite.frame.centerX;
    sprite.displayOriginY = sprite.frame.centerY;

    this.frame = index;
  }

  setStage(stage) {
    if (stage == this.currentStage)
      return;

    console.log(`Changing to stage ${stage}`);

    let sprite = this.sprite;
    let texture = sprite.texture;

    // Generate key name
    let key = texture.key;
    key = key.substring(0, key.lastIndexOf('/'));
    key = `${key}/${stage}`;

    sprite.setTexture(key);

    this.currentStage = stage;
  }

  isValid() {
    return !!this.sprite;
  }

  move(x, y) {
    //let delta = (elapsed % 1001) / 1000;
    let sprite = this.sprite;

    //console.log(x * delta, y * delta)
    sprite.isoMove(x, y);
    sprite.postUpdate();
  }

  update(elapsed, speed = 1.0) {
    this.totalElapsed += elapsed;

    let sprite = this.sprite;

    //let elapsed = (totalElapsed % 1000);

    let frameTime = (this.frameRate / 1000) * speed;
    let frameIndex = Math.round(this.totalElapsed * frameTime) % (sprite.texture.frameTotal - 1);

    this.setFrame(frameIndex);
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

  get isoPosition() {
    return this.sprite.isoPosition;
  }

  async change(data) {
    await this.load(data);
    this.frame = 0;
    this.totalElapsed = 0;

    let {key, frame} = this.makeTextureInfo();

    let sprite = this.sprite;

    console.log(`Changing to: ${key} - ${frame}`);
    sprite.setTexture(key, frame);
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
