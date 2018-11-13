/* global requireNode */

//import Engine from './shared/engine'
import { Utils } from './shared/misc/Utils'
import { Math } from './shared/misc/Math'

class AGate {
  Enum = requireNode(`enum`)
  Utils = Utils
  Math = Math

  Const = {
    Sprite: {
      DefaultExt: `gif`
    }
  }

  /**
   *
   * @param config
   */
  constructor(config) {
    this.config = config
  }

  /**
   *
   * @param path
   * @returns {string}
   */
  getAppPath(path = ``) {
    if (path.charAt(0) === `/`) {
      return path // dont append absolute path
    }

    return `${this.config.dataPath}/${path}`
  }

  /**
   *
   * @param subDir
   * @returns {string}
   */
  getDataPath(subDir = ``) {
    return `${subDir}`
  }

  /**
   *
   * @param subDir
   * @returns {string}
   */
  getScriptsPath(subDir = ``) {
    return `${this.config.scriptsPath}/${subDir}`
  }

  requireNode(name) {
    return requireNode(name)
  }
}

export default AGate
