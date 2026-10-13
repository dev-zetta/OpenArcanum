/** Add writable fixture fields without changing the constructed object. */
export type MutableFixture<T> = T extends (...args: never[]) => unknown ? T :
  T extends readonly unknown[] ? T : T extends object ?
  { [Key in keyof T]: MutableFixture<T[Key]> } & { [field: string]: unknown } : T
function mutableFixture<T extends object>(value: T): MutableFixture<T> {
  return value as MutableFixture<T>
}
export type FixtureError = NodeJS.ErrnoException & { data?: { code?: string } }

export type MutableFixtureFactory = typeof mutableFixture
module.exports = { mutableFixture }
