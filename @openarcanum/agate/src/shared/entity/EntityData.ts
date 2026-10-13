export interface RawEntityDocument {
  Base?: { prototype?: number | string; [key: string]: unknown }
  [component: string]: unknown
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
export function entityDocument(value: unknown): RawEntityDocument {
  if (!isRecord(value)) throw new TypeError('Converted entity data must be an object.')
  if (value.Base !== undefined && (!isRecord(value.Base) ||
      value.Base.prototype !== undefined && typeof value.Base.prototype !== 'number' && typeof value.Base.prototype !== 'string')) {
    throw new TypeError('Converted entity Base data or prototype identifier is invalid.')
  }
  return value as RawEntityDocument
}
