export const Description = {
  id: `string`,
  text: `string`
}

export const GameBackground = {
  id: `string`,
  text: `string`
}

export const SchematicComponent = {
  amount: `int`,
  prototype: `string`
}

export const SchematicDescription = {
  id: `string`,
  name: `string`,
  description: `string`
}

export const SchematicCategory = {
  id: `string`,
  name: `string`,
  description: `string`
}

export const Schematic = {
  id: `string`,
  description: `SchematicDescription`,
  sprite: `string`,
  type: `string`,
  discipline: `string`,
  component: `SchematicComponent[]`,
  result: `SchematicComponent`
}

export const CritterExperience = {
  amount: `int`,
  level: `int`
}

export const SpellDescription = {
  id: `string`,
  name: `string`,
  description: `string`
}

export const SpellCollege = {
  id: `string`,
  name: `string`,
  description: `string`,
  mastery: `string`
}

export const Skill = {
  id: `string`,
  name: `string`,
  description: `string`
}

export const SkillLevel = {
  id: `string`,
  name: `string`
}

export const Discipline = {
  id: `string`,
  name: `string`,
  description: `string`
}

export const DisciplineLevel = {
  id: `string`,
  name: `string`
}

export const Font = {
  family: `string`,
  size: `int`
}
export const GameBook = {
  id: `string`,
  align: `string`,
  font: `Font`,
  text: `string`
}
