import Math from '../../client/isometric/Math'

import process from "node:process"
import fs from "node:fs"
import Console from "node:console"
const find = require("find") as { fileSync(pattern: RegExp, directory: string): string[] }

let myConsole = false
  ? //typeof process !== `undefined`
    new Console.Console(process.stdout, process.stderr)
  : console

// https://lodash.com/docs/4.17.4

import { v5 as uuidv5 } from 'uuid'
import lodash, { type LoDashStatic } from 'lodash'
const LodashBase = lodash as unknown as LoDashStatic & (new() => object)

export default class Utils extends LodashBase {
  declare static performance: Performance
  /**
   *
   * @param path
   * @returns {boolean}
   */
  static isFileExist(path: string) {
    return fs.existsSync(path)
  }

  /**
   *
   * @param str
   * @returns {boolean}
   */
  static isFirstUpperCase(str: string) {
    return /^[A-Z]/.test(str)
  }

  /**
   *
   */
  static logError(...values: unknown[]) {
    myConsole.error(`AGate: `, ...values)
  }

  /**
   *
   */
  static log(...values: unknown[]) {
    myConsole.log(`AGate: `, ...values)
  }

  /**
   *
   * @param str
   * @returns {Function}
   */
  static stringToFunction(str: string) {
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

    return new Function(...args, body) as (...args: unknown[]) => unknown
  }

  /**
   * Returns filename from path, excluding file extension
   * @param path
   * @returns {string | *}
   */
  static getFileBase(path: string) {
    let dotPos = path.lastIndexOf(`.`)
    let slashPos = path.lastIndexOf(`/`)
    return path.substring(slashPos + 1, dotPos)
  }

  /**
   *
   * @param path
   * @returns {string | *}
   */
  static getFileName(path: string) {
    return path.substring(path.lastIndexOf(`/`) + 1)
  }

  /**
   *
   * @param str
   */
  static upperCamelCase(str: string) {
    return Utils.upperFirst(Utils.camelCase(str))
  }

  /**
   *
   * @param path
   * @param callback
   */
  static loadScripts(path: string, callback: (name: string, script: unknown) => unknown) {
    path = AGate.getScriptsPath(path)

    let regExp = new RegExp('\\.(?:cjs|js)$', 'i')
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
  static objectToJson(object: unknown) {
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
  static jsonToObject(json: string): unknown {
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

  static fastBind<This, Args extends unknown[], Result>(thisArg: This, methodFunc: (this: This, ...args: Args) => Result, ...args: Args) {
    methodFunc.apply(thisArg, args)
  }

  static fastSplice<T>(array: T[], startIndex: number, removeCount: number) {
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
    return Utils.performance.now()
  }

  static snapTo(value: number, gap: number, start = 0, divide = false) {
    if (start === undefined) {
      start = 0
    }

    if (gap === 0) {
      return value
    }

    value -= start
    value = gap * Math.round(value / gap)

    return divide ? (start + value) / gap : start + value
  }

  static getClassName(Clazz: { constructor: { name: string } }) {
    return Clazz.constructor.name
  }
}

Utils.performance = globalThis.performance
