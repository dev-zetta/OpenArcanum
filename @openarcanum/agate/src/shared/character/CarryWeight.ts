export const ENCUMBRANCE_LEVELS = Object.freeze([
  'none', 'light', 'moderate', 'medium', 'significant', 'heavy', 'severe'
] as const)
export type Encumbrance = typeof ENCUMBRANCE_LEVELS[number]
export type CarryingState = { supported: false } | {
  supported: true
  weight: number
  capacity: number
  encumbrance: Encumbrance
}

const RATIOS = [15, 30, 45, 60, 75, 90, 100] as const

/** Integer stone units. CE critter.c:2142 uses strict comparison against
 * truncated integer percentage thresholds; equality enters the next band.
 * This describes the band only, without applying speed or fatigue effects. */
export function calculateEncumbrance(weight: number, capacity: number): Encumbrance {
  if (!Number.isSafeInteger(weight) || weight < 0 || !Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error('Invalid carrying weight or capacity')
  }
  for (let index = 0; index < RATIOS.length; index++) {
    // Avoid an intermediate floating-point rounding error for safe integers.
    const threshold = Number(BigInt(capacity) * BigInt(RATIOS[index]) / 100n)
    if (weight < threshold) return ENCUMBRANCE_LEVELS[index]
  }
  return 'severe'
}

export function carryingState(weight: number, capacity: number): Extract<CarryingState, { supported: true }> {
  return { supported: true, weight, capacity, encumbrance: calculateEncumbrance(weight, capacity) }
}
