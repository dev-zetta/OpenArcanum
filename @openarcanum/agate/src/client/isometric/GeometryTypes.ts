export interface Point2Like { x: number; y: number }
export interface Point3Like extends Point2Like { z: number }
export interface CubeLike extends Point3Like { widthX: number; widthY: number; height: number }
export interface Bounds2Like extends Point2Like { right: number; bottom: number }
export interface Bounds3Like extends Point3Like { frontX: number; frontY: number; top: number }
export interface TreeSprite<T> { body: T | null; exists: boolean }
export interface TreeGroup<T> { forEach(callback: (sprite: TreeSprite<T>) => void, context: unknown, checkExists: boolean): void }
export interface FrameData {
  frame: { x: number; y: number; w: number; h: number }
  trimmed?: boolean; rotated?: boolean
  sourceSize?: { w: number; h: number }
  spriteSourceSize?: Point2Like
  anchor?: Point2Like; center?: Point2Like
  [key: string]: unknown
}
export interface SpritesheetData { frames: Record<string, FrameData>; animations?: Record<string, string[]>; [key: string]: unknown }
