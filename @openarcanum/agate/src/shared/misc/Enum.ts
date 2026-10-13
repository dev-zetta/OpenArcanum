/** Typed view of the existing `enum` package's named numeric items. */
export interface EnumItem<Name extends string = string> {
  key: Name
  value: number
  is(value: string | number | EnumItem): boolean
  toString(): string
  valueOf(): number
}
export type EnumValues<Name extends string> = { readonly [Key in Name]: EnumItem<Key> } & {
  enums: EnumItem<Name>[]
  get(value: string | number | EnumItem): EnumItem<Name>
}
interface EnumConstructor {
  new<const Name extends string>(values: readonly Name[], options?: { ignoreCase?: boolean; freeze?: boolean }): EnumValues<Name>
}
const Enum = require('enum') as EnumConstructor
export default Enum
