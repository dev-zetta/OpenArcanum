// @flow

import Utils from './misc/Utils'


export default class Flags {
  _set: Set<string>

  /**
   *
   * @param list
   */
  constructor(/*list: Array<string>*/) {
    //super(...arguments);
    this._set = new Set()
  }

  /**
   *
   * @param val
   */
  add(val: string) {
    if (Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        this.add(val[i])
      }
    } else {
      /*if (!AGate.Utils.isString(val))
  return;*/

      this._set.add(String(val))
    }
  }

  /**
   *
   * @param val
   */
  remove(val: string) {
    if (Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        this.remove(val[i])
      }

      return
    }

    this._set.delete(String(val))
  }

  /**
   *
   * @param val
   * @returns {*}
   */
  getMissing(val: string | Array<string>): Array<string> {
    if (Utils.isArray(val)) {
      let missing = []
      for (let i = 0; i < val.length; i++) {
        if (!this.has(val[i])) {
          missing.push(val[i])
        }
      }

      return missing
    } else {
      if (!this.has(val)) {
        return [val]
      }
    }

    return []
  }

  /**
   *
   * @param val
   * @returns {*}
   */
  hasAny(val: string): boolean {
    if (Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (this.has(val[i])) {
          return true
        }
      }

      return false
    }

    return this.has(val)
  }

  /**
   *
   * @param val
   * @returns {boolean}
   */
  has(val: string): boolean {
    return this._set.has(String(val))
  }

  set(flags: Array<string>) {
    this.clear()
    this.add(flags)
  }


  clear() {
    this._set.clear()
  }
}
