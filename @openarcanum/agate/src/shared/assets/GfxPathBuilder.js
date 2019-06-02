/* global AGate */

import Gfx from '../enums/Gfx'

export default class GfxPathBuilder {
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
      data.type = Gfx.Types.get(data.type)
    }

    switch (data.type) {
      case Gfx.Types.Tile:
        base += `${data.start.category}/${data.end.category}/${
          data.start.version
        }/${data.end.version}`
        break
      case Gfx.Types.Wall:
        base += `${data.category}/${data.part}/${data.side}/${data.version}`
        break
      case Gfx.Types.Portal:
        base += `${data.category}/${data.name}/${data.version}`
        break
      case Gfx.Types.Scenery:
        base += `${data.category}/${data.name}`
        break
      case Gfx.Types.Item:
        let number = data.number ? data.number : 0
        let subcat = data.subcat ? data.subcat : `Base`
        base += `${data.category}/${subcat}/${number}/${data.display}`
        break
      case Gfx.Types.Container:
        base += `${data.category}/${data.name}` // ok
        break
      case Gfx.Types.Light:
      case Gfx.Types.Roof:
      case Gfx.Types.Facade:
        base += `${data.name}` // ok
        break
      case Gfx.Types.Critter:
        let gender = data.race == `Human` ? data.gender : `Male`
        base += `${data.race}/${gender}/${data.armor}/${data.shield}/${
          data.weapon
        }/${data.animation}`
        break
      case Gfx.Types.Monster:
        base += `${data.name}/${data.armor}/${data.shield}/${data.weapon}/${
          data.animation
        }`
        break
      case Gfx.Types.UniqueNpc:
        base += `${data.name}/${data.shield}/${data.weapon}/${data.animation}`
        break
      case Gfx.Types.EyeCandy:
        base += `${data.layer}`
        break
    }

    this.path = base
  }
}
