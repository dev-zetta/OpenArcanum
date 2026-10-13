import type { EnumItem } from '../misc/Enum'
import type { VisualClass } from '../entity/components/Visual'
export interface TileTransition { category: string; version: number }
/** Converted ART metadata has category-specific fields; the builder preserves
 * their original spelling and optional omission semantics. */
export interface GfxDefinition extends Omit<VisualClass, 'type'> {
  type?: string | EnumItem
  start?: TileTransition
  end?: TileTransition
  category?: string
  part?: string | number
  side?: number
  version?: number
  name?: string | number
  number?: number
  subcat?: string | number
  display?: string
  race?: string
  gender?: string
  armor?: string
  shield?: string
  weapon?: string
  animation?: string
  layer?: string | number
}
import Gfx from '../enums/Gfx'
import Utils from '../misc/Utils'

export default class GfxPathBuilder {

  /**
   *
   * @param data
   */
  static build(data: GfxDefinition): string {

    let type = data.type!
    if (typeof type === 'string') {
      type = Gfx.Types.get(type)
    }

    let base = `${type.key}/`

    switch (type) {
      case Gfx.Types.Tile:
        base += `${data.start!.category}/${data.end!.category}/${data.start!.version}/${data.end!.version}`
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
      case Gfx.Types.Item: {
        let number = data.number ? data.number : 0
        let subcat = data.subcat ? data.subcat : `Base`
        base += `${data.category}/${subcat}/${number}/${data.display}`
        break
      }
      case Gfx.Types.Container:
        base += `${data.category}/${data.name}` // ok
        break
      case Gfx.Types.Light:
      case Gfx.Types.Roof:
      case Gfx.Types.Facade:
        base += `${data.name}` // ok
        break
      case Gfx.Types.Critter: {
        let gender = data.race === `Human` ? data.gender : `Male`
        base += `${data.race}/${gender}/${data.armor}/${data.shield}/${data.weapon}/${data.animation}`
        break
      }
      case Gfx.Types.Monster:
        base += `${data.name}/${data.armor}/${data.shield}/${data.weapon}/${data.animation}`
        break
      case Gfx.Types.UniqueNpc:
        base += `${data.name}/${data.shield}/${data.weapon}/${data.animation}`
        break
      case Gfx.Types.EyeCandy:
        base += `${data.layer}`
        break
    }

    return base
  }
}
