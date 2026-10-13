export interface BendingOptions { increments: number; percent: number; min?: number; max?: number }
export type BendingOverride = Partial<BendingOptions>
export interface BendingOverrides {
  position?: BendingOverride
  velocity?: BendingOverride
  angle?: BendingOverride
  angularVelocity?: BendingOverride
  positionLocal?: BendingOverride
  velocityLocal?: BendingOverride
  angleLocal?: BendingOverride
  angularVelocityLocal?: BendingOverride
}
export interface BendingStep { dt?: number }
