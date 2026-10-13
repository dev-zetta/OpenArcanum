import Utils from '../misc/NetworkUtils'
import type Serializer from './Serializer'

export interface NetProperty { type: string; itemType?: string }
export type NetScheme = Record<string, NetProperty>
export interface SerializeOptions { dataBuffer?: ArrayBufferLike; bufferOffset?: number; dry?: boolean }
export interface SerializeResult { dataBuffer: ArrayBufferLike | undefined; bufferOffset: number }
export interface SerializableConstructor {
  new (...args: never[]): Serializable
  readonly name: string
  readonly netScheme: NetScheme | null
}

class Serializable {
  declare classId: number | undefined
  declare netScheme: NetScheme | null | undefined

  init(_params: unknown, _data: unknown): void {}

  /** Schema-based reflection stays at this wire-format boundary. */
  serialize(serializer: Serializer, options: SerializeOptions = {}): SerializeResult {
    const settings = { bufferOffset: 0, ...options }
    const netScheme = this.netScheme || Reflect.get(this.constructor, 'netScheme') as NetScheme | null | undefined
    const classId = this.classId || Utils.hashStr(this.constructor.name, 8)
    const bufferOffset = settings.bufferOffset
    let localBufferOffset = 0
    let dataBuffer = settings.dataBuffer
    if (dataBuffer == null && !settings.dry) dataBuffer = new ArrayBuffer(this.serialize(serializer, { dry: true }).bufferOffset)
    const dataView = settings.dry ? undefined : new DataView(dataBuffer!)
    if (dataView) dataView.setUint8(bufferOffset + localBufferOffset, classId)
    localBufferOffset += Uint8Array.BYTES_PER_ELEMENT
    if (!netScheme) console.warn('no netScheme defined! This will result in awful performance')
    for (const property of Object.keys(netScheme || {}).sort()) {
      const scheme = netScheme![property]
      const value: unknown = Reflect.get(this, property)
      if (dataView) serializer.writeDataView(dataView, value, bufferOffset + localBufferOffset, scheme)
      if (scheme.type === 'string') {
        localBufferOffset += Uint16Array.BYTES_PER_ELEMENT
        if (value !== null && value !== undefined) localBufferOffset += (value as string).length * Uint16Array.BYTES_PER_ELEMENT
      } else if (scheme.type === 'class') {
        localBufferOffset += (value as Serializable).serialize(serializer, { dry: true }).bufferOffset
      } else if (scheme.type === 'list') {
        localBufferOffset += Uint16Array.BYTES_PER_ELEMENT
        for (const item of value as unknown[]) {
          if (scheme.itemType === 'class') localBufferOffset += (item as Serializable).serialize(serializer, { dry: true }).bufferOffset
          else if (scheme.itemType === 'string') localBufferOffset += Uint16Array.BYTES_PER_ELEMENT * (1 + (item as string).length)
          else localBufferOffset += serializer.getTypeByteSize(scheme.itemType!)
        }
      } else localBufferOffset += serializer.getTypeByteSize(scheme.type)
    }
    return { dataBuffer, bufferOffset: localBufferOffset }
  }

  syncTo(other: Serializable): void {
    const netScheme = Reflect.get(this.constructor, 'netScheme') as NetScheme | null | undefined
    for (const property in netScheme) {
      const scheme = netScheme[property]
      if (scheme.type === 'list' || scheme.type === 'class') continue
      const value: unknown = Reflect.get(other, property)
      if (scheme.type === 'string' && typeof value !== 'string') continue
      Reflect.set(this, property, value)
    }
  }
}
export default Serializable
