/* global AGate */

import {GfxTypes} from '../enums/Gfx'

export class GfxPathBuilder {
  /**
   *
   * @param data
   */
  constructor(data) {
    this.build(data)
  }

  /**
   *
   * @returns {string}
   */
  toPath() {
    return `${this.path}`
  }

  /**
   *
   * @param data
   */
  build(data) {
    let base = `${data.type.key}/`

    if (AGate.Utils.isString(data.type)) {
      data.type = GfxTypes.get(data.type)
    }

    switch (data.type) {
      case GfxTypes.Tile:
        base += `${data.start.category}/${data.end.category}/${
          data.start.version
        }/${data.end.version}`
        break
      case GfxTypes.Wall:
        base += `${data.category}/${data.part}/${data.side}/${data.version}`
        break
      case GfxTypes.Portal:
        base += `${data.category}/${data.name}/${data.version}`
        break
      case GfxTypes.Scenery:
        base += `${data.category}/${data.name}`
        break
      case GfxTypes.Item:
        let number = data.number ? data.number : 0
        let subcat = data.subcat ? data.subcat : `Base`
        base += `${data.category}/${subcat}/${number}/${data.display}`
        break
      case GfxTypes.Container:
        base += `${data.category}/${data.name}` // ok
        break
      case GfxTypes.Light:
      case GfxTypes.Roof:
      case GfxTypes.Facade:
        base += `${data.name}` // ok
        break
      case GfxTypes.Critter:
        let gender = data.race == `Human` ? data.gender : `Male`
        base += `${data.race}/${gender}/${data.armor}/${data.shield}/${
          data.weapon
        }/${data.animation}`
        break
      case GfxTypes.Monster:
        base += `${data.name}/${data.armor}/${data.shield}/${data.weapon}/${
          data.animation
        }`
        break
      case GfxTypes.UniqueNpc:
        base += `${data.name}/${data.shield}/${data.weapon}/${data.animation}`
        break
      case GfxTypes.EyeCandy:
        base += `${data.layer}`
        break
    }

    this.path = base
  }
}
