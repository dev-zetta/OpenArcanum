/* global requireNode */
import AGate from '../agate';
import {Utils} from './Utils';
//var liquidfun = requireNode('liquidfun')

export var GfxTypes = new AGate.Enum(
  [
    'Tile',
    'Wall',
    'Portal',
    'Critter',
    'Scenery',
    'Item',
    'Container',
    'Light',
    'Roof',
    'Facade',
    'Monster',
    'UniqueNpc',
    'EyeCandy']);

export class GfxPathBuilder {
  constructor(data) {
    this.build(data);
  }

  toPath() {
    return `${this.path}`;
  }

  build(data) {
    let base = `${data.type}/`;

    switch (GfxTypes.get(data.type)) {
      case GfxTypes.Tile:
        base += `${data.start.category}/${data.end.category}/${data.start.version}/${data.end.version}`;
        break;
      case GfxTypes.Wall:
        base += `${data.category}/${data.part}/${data.side}/${data.version}`;
        break;
      case GfxTypes.Portal:
        base += `${data.category}/${data.name}/${data.version}`;
        break;
      case GfxTypes.Scenery:
        base += `${data.category}/${data.name}`;
        break;
      case GfxTypes.Item:
        base += `${data.category}/${data.subtype}/${data.number}/${data.display}`;
        break;
      case GfxTypes.Container:
        base += `${data.category}/${data.name}`; // ok
        break;
      case GfxTypes.Light:
      case GfxTypes.Roof:
      case GfxTypes.Facade:
        base += `${data.name}`; // ok
        break;
      case GfxTypes.Critter:
        base += `${data.race}/${data.gender}/${data.armor}/${data.shield}/${data.weapon}/${data.animation}`;
        break;
      case GfxTypes.Monster:
        base += `${data.name}/${data.armor}/${data.shield}/${data.weapon}/${data.animation}`;
        break;
      case GfxTypes.UniqueNpc:
        base += `${data.name}/${data.shield}/${data.weapon}/${data.animation}`;
        break;
      case GfxTypes.EyeCandy:
        base += `${data.layer}`;
        break;
    }

    this.path = base;
  }
}

const fs = AGate.requireNode('fs');
const util = AGate.requireNode('util');
const mime = AGate.requireNode('mime-types');
const loadJsonFile = requireNode('load-json-file');

export class AssetLoader {
  constructor(engine) {
    this.engine = engine;
    this.loadedAssets = {};
    this.preloadAssets = [];

    this.useBlobs = false;
  }

  hasAsset(key) {
    return this.loadedAssets.hasOwnProperty(key);
  }

  preload(descriptor) {
    this.preloadAssets.push(descriptor);
    this.loadedAssets[descriptor.key] = null;
  }

  start(onAssetLoaded, onAllLoaded) {
    var loaded = 0;
    for (let i = 0; i < this.preloadAssets.length; i++) {
      let descriptor = this.preloadAssets[i];

      if (descriptor == null)
        continue;

      this.loadAsset(descriptor, (err, descriptor, image, data) => {
        onAssetLoaded(err, descriptor, image, data);

        this.loadedAssets[descriptor.key] = descriptor;
        loaded++;

        if (loaded == this.preloadAssets.length) {
          this.preloadAssets.clear();
          onAllLoaded();
        }
      });

      this.preloadAssets[i] = null;
    }
  }

  stringToBlob(string, contentType = '', sliceSize = 512) {
    const byteCharacters = string;
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, {type: contentType});
    return blob;
  }

  loadFileToBlob(src) {
    var data = fs.readFileSync(src).toString('binary');
    var blob = this.stringToBlob(data);
    return blob;
  }

  loadFileToBlobUrl(src) {
    //var data = fs.readFileSync(src).toString("base64")
    //return util.format("data:%s;base64,%s", mime.lookup(src), data)

    var blob = this.loadFileToBlob(src);
    return URL.createObjectURL(blob);
  }

  loadFileToDataUrl(src) {
    var data = fs.readFileSync(src).toString('base64');
    return util.format('data:%s;base64,%s', mime.lookup(src), data);
  }

  createAndLoadImage(src, callback) {
    if (AGate.Utils.isUndefined(createImageBitmap)) {
      let image = new Image();

      //image.crossOrigin = true
      if (this.useBlobs) {
        image.src = this.loadFileToBlobUrl(src);

        image.onload = () => {
          URL.revokeObjectURL(image.src);

          callback(false, image);
        };

        image.onerror = () => {
          URL.revokeObjectURL(image.src);

          callback(true, image);
        };
      } else {
        image.src = this.loadFileToDataUrl(src);

        image.onload = () => {

          callback(false, image);
        };

        image.onerror = () => {

          callback(true, image);
        };
      }

      return image;
    } else {
      //console.log('Fast loading...')
      var blob = this.loadFileToBlob(src);
      createImageBitmap(blob).then(function(response) {
        callback(false, response);
      });
    }
  }

  loadTextFile(path, callback) {
    return fs.readFile(path, 'utf8', callback);
  }

  loadJsonFile(filePath, onLoad) {
    if (Utils.isFunction(onLoad)) {
      return loadJsonFile(filePath).then(onLoad);
    } else {
      return loadJsonFile.sync(filePath);
    }
  }

  loadAsset(descriptor, callback) {
    switch (descriptor.type) {
      case 'atlas':
        this.createAndLoadImage(descriptor.texture, (err, image) => {
          if (err) {
            console.log(`Unable to load file: ${descriptor.texture}`);
            callback(true);
            return;
          }

          this.loadJsonFile(descriptor.data, (data) => {
            if (AGate.Utils.isUndefined(data)) {
              console.log(`Unable to load file: ${descriptor.data}`);
              callback(true);
              return;
            }

            callback(false, descriptor, image, data);
          });
        });

        break;
    }
  }
}
