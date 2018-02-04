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

    //console.log(data.type);

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
const loadJsonFile = AGate.requireNode('load-json-file');
const writeJsonFile = AGate.requireNode('write-json-file');
const find = AGate.requireNode('find');

export class AssetLoader {
  constructor(engine) {
    this.engine = engine;
    this.loadedAssets = new Map();
    this.preloadAssets = [];

    this.useBlobs = false;
  }

  hasAsset(key) {
    return this.loadedAssets.has(key);
  }

  preload(descriptor) {
    this.preloadAssets.push(descriptor);
    this.loadedAssets.set(descriptor.key, null);
  }

  async start(onAssetLoaded) {
    //return new Promise(resolve => {
      var loaded = 0;
      for (let i = 0; i < this.preloadAssets.length; i++) {
        let descriptor = this.preloadAssets[i];

        if (descriptor == null)
          continue;

        let result = await this.loadAsset(descriptor);
        if (!result) {
          continue;
        }
        onAssetLoaded(descriptor);

        this.loadedAssets.set(descriptor.key, descriptor);
        loaded++;

        this.preloadAssets[i] = null;

        if (loaded == this.preloadAssets.length) {
          this.preloadAssets.clear();
          //resolve(loaded);
        }


      }
    //});

    return true; //Promise.resolve(loaded);
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

  async loadFileToBlob(src) {
    return new Promise(resolve => {
      fs.readFile(src, undefined, (err, data) => {
        if(err){
          AGate.Utils.logError(`Unable to load file: ${src}`);
          resolve(null);
        } else {
          let blob = this.stringToBlob(data.toString('binary'));
          resolve(blob);
        }


      });

    });
  }

  async loadFileToBlobUrl(src) {
    //var data = fs.readFileSync(src).toString("base64")
    //return util.format("data:%s;base64,%s", mime.lookup(src), data)

    var blob = this.loadFileToBlob(src);
    return URL.createObjectURL(blob);
  }

  async loadFileToDataUrl(src) {
    return new Promise(resolve => {
      fs.readFile(src, 'base64', (err, data) => {
        let result = util.format('data:%s;base64,%s', mime.lookup(src), data.toString('binary'));
        resolve(result);
      });

    });
  }

  async createAndLoadImage(src) {
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
      let blob = await this.loadFileToBlob(src);
      if (!blob) {
        AGate.Utils.logError(`Unable to load image: ${src}`);
        return new Image();
      }


      return await createImageBitmap(blob);
    }
  }

  async loadTextFile(path) {
    return new Promise(resolve => {
      fs.readFile(path, 'utf8', (err, data) => {
        resolve(data);
      });
    });
  }

  async saveTextFile(path, data) {
    return new Promise(resolve => {
      fs.writeFile(path, data, 'utf8', (err, data) => {
        resolve(data);
      });
    });
  }

  async loadJsonFile(filePath) {
    try {
      return await loadJsonFile(filePath);

    } catch (err) {
      AGate.Utils.logError(err.message);
      return null;
    }
  }

  async saveJsonFile(filePath, object) {
    try {
      return await writeJsonFile(filePath, object);

    } catch (err) {
      AGate.Utils.logError(err.message);
      return null;
    }
  }

  async loadAsset(descriptor) {
    let result;

    switch (descriptor.type) {
      case 'atlas':
        switch (descriptor.output) {
          case 'base64':
            descriptor.image = await this.loadFileToDataUrl(descriptor.texture);
            break;
          default:
            descriptor.image = await this.createAndLoadImage(descriptor.texture);
            break
        }

        if (!descriptor.image) {
          AGate.Utils.logError(`Unable to load file: ${descriptor.texture}`);
          return false; //Promise.resolve(false);
        }

        descriptor.meta = await this.loadJsonFile(descriptor.data);

        if (AGate.Utils.isUndefined(descriptor.meta)) {
          AGate.Utils.logError(`Unable to load file: ${descriptor.data}`);
          return false; //Promise.resolve(false);
        }

        break;
    }

    return true; //Promise.resolve(true);
  }

  async findFiles(dir, ext) {
    let regExp = new RegExp(`\.${ext}`, 'i');
    return new Promise(resolve => {
      let list = find.fileSync(regExp, dir);
      resolve(list);
    });
  }

  async findDirs(dir, pattern) {
    return new Promise(resolve => {
      let list = find.dirSync(pattern, dir);
      resolve(list);
    });
  }
}
