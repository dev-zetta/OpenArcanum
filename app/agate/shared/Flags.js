import AGate from '../agate';

export class Flags  {
  constructor(list) {
    //super(...arguments);
    this._set = new Set(list);
  }

  add(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++)
        this.add(val[i]);

      return;
    }

    /*if (!AGate.Utils.isString(val))
      return;*/

    this._set.add(String(val));
  }

  remove(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++)
        this.remove(val[i]);

      return;
    }

    this._set.delete(String(val));
  }

  getMissing(val) {
    if (AGate.Utils.isArray(val)) {
      let missing = [];
      for (let i = 0; i < val.length; i++) {
        if (!this.has(val[i]))
          missing.push(val[i]);
      }

      return missing;
    }

    return this.has(val);
  }

  hasAny(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (this.has(val[i]))
          return true;
      }

      return false;
    }

    return this.has(val);
  }

  has(val) {
    return this._set.has(String(val));
  }

}
