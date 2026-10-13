/* global AGate */

import Enum from '../misc/Enum'

export default {
  Types: new Enum([
    `Tile`,
    `Wall`,
    `Portal`,
    `Critter`,
    `Scenery`,
    `Item`,
    `Container`,
    `Light`,
    `Roof`,
    `Facade`,
    `Monster`,
    `UniqueNpc`,
    `EyeCandy`
  ]),

  Gender: new Enum([`Female`, `Male`, `Both`]),
  Shield: new Enum([`None`, `Shield`]),
  Race: new Enum([`Human`, `Dwarf`, `Gnome`, `Halfling`, `Elf`])
}
