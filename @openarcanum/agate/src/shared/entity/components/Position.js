/* global AGate */
import Core from './Core'
export default class Position {
  constructor() {
    this._x = 0
    this._y = 0
  }

  get x() {
    return this._x
  }
  set x(v) {
    this._x = Math.floor(v)
  }

  get y() {
    return this._y
  }
  set y(v) {
    this._y = Math.floor(v)
  }
}
