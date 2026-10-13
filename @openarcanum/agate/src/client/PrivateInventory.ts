import type { PrivateItem } from './PrivateInventoryTypes'
import { calculateEncumbrance, type CarryingState } from '../shared/character/CarryWeight'
import { isRecord, isInteger } from './SessionTypes'

export function privateItems(rows: unknown): PrivateItem[] {
  const ids = new Set<string>(), slots = new Set<number>()
  const invalid = () => new Error('Local server supplied invalid private inventory contents')
  if (!Array.isArray(rows) || rows.length > 1024) throw invalid()
  return rows.map((item: unknown): PrivateItem => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || item.id.length > 1024 || ids.has(item.id) ||
        !isInteger(item.slot) || item.slot < 0 || slots.has(item.slot) ||
        typeof item.label !== 'string' || !item.label || item.label.length > 128 ||
        typeof item.type !== 'string' || !item.type || item.type.length > 32 ||
        !isInteger(item.prototypeId) || item.prototypeId < 1 ||
        (item.quantity !== undefined && (!isInteger(item.quantity) || item.quantity < 1)) ||
        (item.canDrop !== undefined && (item.canDrop !== true || item.type !== 'Generic')) ||
        (item.weight !== undefined && (!isInteger(item.weight) || item.weight < 0))) throw invalid()
    ids.add(item.id); slots.add(item.slot)
    const { id, slot, label, type, prototypeId, quantity, canDrop, weight } = item
    return { id, slot, label, type, prototypeId, ...(quantity === undefined ? {} : { quantity }),
      ...(canDrop === true ? { canDrop: true } : {}), ...(weight === undefined ? {} : { weight }) }
  })
}

/** Only owner-private acknowledgements can supply carrying metadata. */
export function readCarryingState(value: unknown, items: readonly PrivateItem[]): CarryingState {
  const invalid = () => new Error('Local server supplied invalid carrying metadata')
  if (value === undefined) {
    if (items.some(item => item.weight !== undefined)) throw invalid()
    return { supported: false }
  }
  if (!isRecord(value) || typeof value.supported !== 'boolean') throw invalid()
  if (!value.supported) {
    if (Object.keys(value).length !== 1 || items.some(item => item.weight !== undefined)) throw invalid()
    return { supported: false }
  }
  if (Object.keys(value).length !== 4 || !['supported', 'weight', 'capacity', 'encumbrance'].every(key => Object.hasOwn(value, key)) ||
      !isInteger(value.weight) || value.weight < 0 || !isInteger(value.capacity) || value.capacity < 1 ||
      items.some(item => item.weight === undefined || !['Generic', 'Key'].includes(item.type) || item.quantity !== undefined)) throw invalid()
  const total = items.reduce((sum, item) => sum + item.weight!, 0)
  if (!Number.isSafeInteger(total) || total !== value.weight ||
      calculateEncumbrance(value.weight, value.capacity) !== value.encumbrance) throw invalid()
  return { supported: true, weight: value.weight, capacity: value.capacity,
    encumbrance: calculateEncumbrance(value.weight, value.capacity) }
}
