/* global AGate, window, requireNode */


const process = requireNode(`process`)

const fs = requireNode(`fs`)
const lodash = requireNode(`lodash`)
const find = requireNode(`find`)

const Console = requireNode(`console`)

let myConsole = false ? new Console.Console(process.stdout, process.stderr) : console

// https://lodash.com/docs/4.17.4

const uuidv5 = requireNode(`uuid/v5`)

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
    return path.substring(path.lastIndexOf(`/`) + 1)
  }

  /**
   *
   */
  static logError() {
    myConsole.error(`AGate: `, ...arguments)
  }

  /**
   *
   */
  static log() {
    myConsole.log(`AGate: `, ...arguments)
  }

  /**
   *
   * @param str
   * @returns {Function}
   */
  static stringToFunction(str) {
    let bodyIdx = str.indexOf(`{`)
    let body = str.substring(bodyIdx + 1, str.lastIndexOf(`}`))
    let declare = str.substring(0, bodyIdx)

    let params
    let bracketPos = declare.indexOf(`(`)
    if (bracketPos === -1) {
      params = declare.substring(0, declare.lastIndexOf(`=>`)).trim()
    } else {
      params = declare.substring(bracketPos + 1, declare.lastIndexOf(`)`))
    }

    let args = params.split(`,`)

    return new Function(args, body)
  }

  /**
   * Returns filename from path, excluding file extension
   * @param path
   * @returns {string | *}
   */
  static getFileBase(path) {
    let dotPos = path.lastIndexOf(`.`)
    let slashPos = path.lastIndexOf(`/`)
    return path.substring(slashPos + 1, dotPos)
  }

  /**
   *
   * @param path
   * @param callback
   */
  static loadScripts(path, callback) {
    path = AGate.getScriptsPath(path)

    let regExp = new RegExp(`\..js`, `i`)
    let list = find.fileSync(regExp, path)

    console.log(list)
    list.forEach(path => {
      let script = require(path)
      let name = AGate.Utils.getFileBase(path)

      callback(name, script)
    })
  }

  static getRandomUUID() {
    const MY_NAMESPACE = `4ea2b974-fc49-4c84-b03d-7cb70946e583`
    return uuidv5(`agate-ecs`, MY_NAMESPACE)
  }
}

if (window.performance) {
  Utils.performance = window.performance
} else {
  alert(`TODO`)
}
