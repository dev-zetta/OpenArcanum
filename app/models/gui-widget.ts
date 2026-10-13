import type { Type } from '@warp-drive/core/types/symbols'
import Model, { attr, hasMany, belongsTo } from '@ember-data/model'
import { computed } from '@ember/object'
import type { WidgetDefinition, WidgetOptions, WidgetHooks, WidgetStyle, WidgetPosition, WidgetSize, WidgetAnimation } from '../types/widgets'

export default class GuiWidgetModel extends Model {
  declare [Type]: 'gui-widget'
  @attr('string') declare name: string
  @attr('string') declare type: string
  @computed('type') get componentName(): string { return `gui-${this.type || 'widget'}` }
  @attr('string') declare sprite: string | null
  @attr() declare position: WidgetPosition | [string | number, string | number] | string | null
  @attr() declare size: WidgetSize | [string | number, string | number] | null
  @attr() declare style: WidgetStyle | string | null
  @attr() declare prototype: string | null
  @attr() declare visible: boolean | null
  @attr() declare value: unknown
  @attr() declare animation: WidgetAnimation | null
  @attr() declare events: WidgetHooks | string | null
  @attr() declare listeners: WidgetHooks | string | null
  @attr() declare methods: WidgetHooks | string | null
  @attr() declare options: WidgetOptions | null
  @belongsTo('gui-widget', { async: false, inverse: 'components' }) declare parent: GuiWidgetModel | null
  @hasMany('gui-widget', { async: false, inverse: 'parent' }) declare components: GuiWidgetModel[]
}


export type { WidgetDefinition }
