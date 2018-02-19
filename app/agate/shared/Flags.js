import AGate from '../agate';

export class Flags extends Set {
  constructor() {
    super();
  }

  add(val) {
    if (AGate.Utils.isArray(val)) {
      for (let i = 0; i < val.length; i++)
        this.add(val[i]);

      return;
    }

    if (!AGate.Utils.isString(val))
      return;

    super.add(val);
  }

  has(val) {
    if (AGate.Utils.isArray(val)) {
      let missing = [];
      for (let i = 0; i < val.length; i++) {
        if (!super.has(val[i]))
          missing.push(val[i]);
      }

      return missing;
    }

    return super.has(val);
  }

}
