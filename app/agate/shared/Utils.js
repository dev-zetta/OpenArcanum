/* global requireNode */

const console = requireNode('console');
const process = requireNode('process');

const fs = requireNode('fs');
const lodash = requireNode('lodash');

var myConsole = new console.Console(process.stdout, process.stderr);

// https://lodash.com/docs/4.17.4

export class Utils extends lodash {
  static isFileExist(path) {
    return fs.existsSync(path);
  }

  static getLastDir(path) {
    return path.substring(path.lastIndexOf('/') + 1);
  }

  static logError() {
    myConsole.log('AGate: ', ...arguments);
  }

  static stringToFunction(str) {
    let fn_body_idx = str.indexOf('{'),
      fn_body = str.substring(fn_body_idx+1, str.lastIndexOf('}')),
      fn_declare = str.substring(0, fn_body_idx),
      fn_params = fn_declare.substring(fn_declare.indexOf('(')+1, fn_declare.lastIndexOf(')')),
      args = fn_params.split(',');

    return new Function(args, fn_body);
  }

}
