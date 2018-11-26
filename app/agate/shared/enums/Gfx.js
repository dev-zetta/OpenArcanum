/* global AGate */

export const GfxTypes = new AGate.Enum([
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
])

export const Gender = new AGate.Enum([`Female`, `Male`, `Both`])

export const Shield = new AGate.Enum([`None`, `Shield`])

export const Race = new AGate.Enum([`Human`, `Dwarf`, `Gnome`, `Halfling`, `Elf`])
