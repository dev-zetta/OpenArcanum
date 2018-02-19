/* global requireNode */

//import Engine from './shared/engine'
import {Utils} from './shared/Utils';
import {Math} from './shared/Math';

//import 'reflect-metadata';

class AGate {
  static getAppPath(subDir = '') {
    return `/media/maxli/Data/dev/ArcanumAlive/Data/converted/${subDir}`;
  }

  static getDataPath(subDir = '') {
    return `${subDir}`;
  }

  /*static getDataUrl(subDir = '') {
      return `http://localhost:7000/${subDir}`
  }*/

  static requireNode(name) {
    return requireNode(name);
  }

}

AGate.Enum = AGate.requireNode('enum');
//AGate.Engine = Engine
AGate.Utils = Utils;
AGate.Math = Math;

AGate.Const = {
  Sprite: {
    'DefaultExt': 'gif',
  },

};

export default AGate;
