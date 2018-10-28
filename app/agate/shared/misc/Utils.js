/* global AGate, window, requireNode */

const console = requireNode('console')
const process = requireNode('process')

const fs = requireNode('fs')
const lodash = requireNode('lodash')
const find = requireNode('find')

var myConsole = new console.Console(process.stdout, process.stderr)

// https://lodash.com/docs/4.17.4

export class Utils extends lodash {

  /**
   *
   * @param path
   * @returns {boolean}
   */
  static isFileExist(path) {
    return fs.existsSync(path)
  }

  /**
   *
   * @param path
   * @returns {string | *}
   */
  static getLastDir(path) {
    return path.substring(path.lastIndexOf('/') + 1)
  }

  /**
   *
   */
  static logError() {
    myConsole.log('AGate: ', ...arguments)
  }

  /**
   *
   * @param str
   * @returns {Function}
   */
  static stringToFunction(str) {
    let fn_body_idx = str.indexOf('{'),
      fn_body = str.substring(fn_body_idx + 1, str.lastIndexOf('}')),
      fn_declare = str.substring(0, fn_body_idx),
      fn_params = fn_declare.substring(
        fn_declare.indexOf('(') + 1,
        fn_declare.lastIndexOf(')')
      ),
      args = fn_params.split(',')

    return new Function(args, fn_body)
  }

  /**
   * Returns filename from path, excluding file extension
   * @param path
   * @returns {string | *}
   */
  static getFileBase(path) {
    let dotPos = path.lastIndexOf('.')
    let slashPos = path.lastIndexOf('/')
    return path.substring(slashPos + 1, dotPos)
  }

  /**
   *
   * @param path
   * @param callback
   */
  static loadScripts(path, callback) {
    path = AGate.getScriptsPath(path)

    let regExp = new RegExp(`\..js`, 'i')
    let list = find.fileSync(regExp, path)

    list.forEach(path => {
      let script = require(path)
      let name = AGate.Utils.getFileBase(path)

      callback(name, script)
    })
  }
}

if (window.performance) {
  Utils.performance = window.performance
} else {
  alert('TODO')
}
