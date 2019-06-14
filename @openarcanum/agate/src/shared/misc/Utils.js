/* global AGate, window */

const process = require(`process`)
const fs = require(`fs`)
const Console = require(`console`)
const find = require(`find`)

let myConsole = false
  ? //typeof process !== `undefined`
    new Console.Console(process.stdout, process.stderr)
  : console

// https://lodash.com/docs/4.17.4

import uuidv5 from 'uuid/v5'
import lodash from 'lodash'

export default class Utils extends lodash {
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
   * @param str
   * @returns {boolean}
   */
  static isFirstUpperCase(str) {
    return /^[A-Z]/.test(str)
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
   * @returns {string | *}
   */
  static getFileName(path) {
    return path.substring(path.lastIndexOf(`/`) + 1)
  }

  /**
   *
   * @param str
   */
  static upperCamelCase(str) {
    return Utils.upperFirst(Utils.camelCase(str))
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

    list.forEach(path => {
      let script = require(path)
      let name = Utils.getFileBase(path)

      callback(name, script)
    })
  }

  static getRandomUUID() {
    const MY_NAMESPACE = `4ea2b974-fc49-4c84-b03d-7cb70946e583`
    return uuidv5(`agate-ecs`, MY_NAMESPACE)
  }

  /**
   *
   * @param object
   * @returns {string}
   */
  static objectToJson(object) {
    return JSON.stringify(object, (key, value) => {
      if (typeof value === `function`) {
        //if (key === 'topWin:created')
        //console.error(`aaaaa ${key}`, value)

        value = lodash.replace(
          value.toString(),
          new RegExp(`(void 0)`, `g`),
          `this`
        )
        return `@${value}`
      }
      return value
    })
  }

  /**
   *
   * @param json
   * @returns {any}
   */
  static jsonToObject(json) {
    return JSON.parse(json, (key, value) => {
      if (key === ``) {
        return value
      }

      if (typeof value === `string` && value.startsWith(`@`)) {
        //console.log('ccc', value.substr(1))
        return Utils.stringToFunction(value.substr(1))
      }
      return value
    })
  }

  static fastBind(thisArg, methodFunc) {
    methodFunc.apply(thisArg, arguments)
  }

  static fastSplice(array, startIndex, removeCount) {
    let len = array.length
    let removeLen = 0

    if (startIndex >= len || removeCount === 0) {
      return
    }

    removeCount =
      startIndex + removeCount > len ? len - startIndex : removeCount
    removeLen = len - removeCount

    for (let i = startIndex; i < len; i += 1) {
      array[i] = array[i + removeCount]
    }

    array.length = removeLen
  }

  static getCurrentTimestamp() {
    return window.performance.now()
  }
}

if (window.performance) {
  Utils.performance = window.performance
} else {
  alert(`TODO`)
}
