import type { Cash } from 'cash-dom'
import type GuiWidget from '../pods/components/gui-widget/component'

export type CssDimension = string | number
export interface WidgetPosition { left: CssDimension; top: CssDimension }
export interface WidgetSize { width: CssDimension; height: CssDimension }
export type WidgetStyle = Record<string, string | number | undefined>
export interface WidgetOptions {
  tooltip?: string; label?: string; title?: string; toolbar?: boolean; resizable?: boolean
  min?: number; max?: number; orientation?: 'horizontal' | 'vertical'; placeholder?: string
  src?: string; type?: string; connectWith?: string[]; slotSize?: number; value?: number
}
/** Authored callbacks are supplied by local GUI scripts. Their arguments are runtime values. */
export type WidgetCallback = (this: GuiWidget, ...arguments_: unknown[]) => unknown
export type WidgetHooks = Record<string, WidgetCallback>
export interface WidgetAnimation { duration?: number; repeat?: number }
export interface WidgetDefinition {
  id?: string; name?: string; type?: string; sprite?: string; parent?: string | import('../models/gui-widget').default
  position?: WidgetPosition | [CssDimension, CssDimension] | string
  size?: WidgetSize | [CssDimension, CssDimension]
  style?: WidgetStyle | string; prototype?: string; visible?: boolean; value?: unknown
  animation?: WidgetAnimation; events?: WidgetHooks | string; listeners?: WidgetHooks | string
  methods?: WidgetHooks | string; options?: WidgetOptions; components?: Record<string, WidgetDefinition>
}
export interface GuiFrame { width: number; height: number; left: number; top: number }
export interface GuiSprite {
  attachToElement(element: Cash): void; detachFromElement(element: Cash): void
  getFrame(index?: number): GuiFrame; getLastFrame(): GuiFrame
  getFrameCount(): number; hasFrame(index: number): boolean
}
export interface GuiManager {
  findWidget(id: string, children?: Map<string, GuiWidget>): GuiWidget | undefined
  addWidget(widget: GuiWidget): void; bringWindowTop(widget: GuiWidget): void
  getSprite(key: string): GuiSprite | undefined
  setRootWidget(widget: unknown): void; setMouseSprite(name: string): void
}
export interface InventorySlot { size?: [number, number]; sprite?: string; position?: WidgetDefinition['position'] }
export interface GuiEntity {
  Item?: { inventory: unknown }; Visual?: { current: unknown }
  visual?: { classes?: { current: { sprite?: { getGlobalPosition(): { x: number; y: number } }; animation?: string } } }
  critter?: { aiState: { actions?: Map<string, GuiAIAction> } }
}
export interface GuiAIAction { toString(): string; actions?: Map<string, GuiAIAction> }
