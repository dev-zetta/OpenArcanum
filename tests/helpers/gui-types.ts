import type Owner from '@ember/owner'
import type GuiWidgetModel from '../../app/models/gui-widget'
import type { WidgetDefinition } from '../../app/types/widgets'
import type { AGateRuntime, RuntimeUtils, GameEngine } from '../../app/types/runtime'

export interface GuiStore {
  createRecord(type: 'gui-widget', definition: WidgetDefinition): GuiWidgetModel
  peekRecord(type: 'gui-widget', id: string): GuiWidgetModel | null
  query(type: 'gui-widget', query: { filter: Record<string, unknown> }): Promise<GuiWidgetModel[]>
}
export function guiStore(owner: Owner): GuiStore {
  return owner.lookup('service:store') as GuiStore
}
export function installRuntime(value: {
  Utils: Partial<RuntimeUtils>
  engine?: { client: unknown }
  getAppUrl?(path: string): string
  createEngine?(): unknown
}): void {
  // Test doubles deliberately implement only the API exercised by each test.
  globalThis.AGate = value as AGateRuntime
}

export function fixtureRequire(load: (name: string) => unknown): import('../../app/types/runtime').DesktopRequire {
  // A fixture can omit unrelated filesystem methods; each test controls calls.
  return load as import('../../app/types/runtime').DesktopRequire
}
