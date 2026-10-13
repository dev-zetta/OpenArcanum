import Adapter from '@ember-data/adapter'
import { getAGate } from 'open-arcanum/lib/runtime'
import type { WidgetDefinition } from '../types/widgets'

export interface GuiRecord {
  type: 'gui-widget'; id: string
  attributes: Omit<WidgetDefinition, 'parent' | 'components'> & { name: string }
  relationships: { parent: { data: { type: 'gui-widget'; id: string } | null }; components: { data: { type: 'gui-widget'; id: string }[] } }
}

// GUI definitions are authored local scripts, rather than a mock HTTP API.
export default class ApplicationAdapter extends Adapter {
  records: Map<string, GuiRecord> | null = null
  loadRecords(): Map<string, GuiRecord> {
    if (this.records) return this.records
    const runtime = getAGate()
    if (!runtime) throw new Error('Local GUI scripts require the desktop runtime.')
    const definitions = new Map<string, WidgetDefinition>()
    runtime.Utils.loadScripts('client/gui', (name, definition) => definitions.set(name, definition))
    for (const [name, definition] of definitions) {
      if (typeof definition.parent === 'string') {
        const parent = definitions.get(definition.parent)
        if (!parent) throw new Error(`GUI definition ${name} references missing parent ${definition.parent}.`)
        parent.components ||= {}
        parent.components[name] = definition
      }
    }
    const records = new Map<string, GuiRecord>()
    const visit = (id: string, definition: WidgetDefinition, parent: string | null = null, name = id): void => {
      const { components = {}, parent: _parent, ...attributes } = definition
      // Local authored arrows are revived with widget this; generated callbacks
      // keep their lexical closures and are never serialized here a second time.
      for (const key of ['events', 'listeners', 'methods'] as const) {
        if (attributes[key] && typeof attributes[key] !== 'string') attributes[key] = runtime.Utils.objectToJson(attributes[key])
      }
      const children = Object.entries(components)
      records.set(id, {
        type: 'gui-widget', id, attributes: { ...attributes, name },
        relationships: {
          parent: { data: parent ? { type: 'gui-widget', id: parent } : null },
          components: { data: children.map(([childId]) => ({ type: 'gui-widget', id: `${id}.${childId}` })) }
        }
      })
      for (const [childId, child] of children) visit(`${id}.${childId}`, child, id, childId)
    }
    for (const [id, definition] of definitions) if (!definition.parent) visit(id, definition)
    this.records = records
    return records
  }
  async query(_store: unknown, _type: unknown, query: { filter?: Record<string, unknown> }) {
    const records = [...this.loadRecords().values()]
    const data = records.filter(record => Object.entries(query.filter || {}).every(([key, value]) => Reflect.get(record.attributes, key) === value))
    return { data, included: records.filter(record => !data.includes(record)) }
  }
  async findRecord(_store: unknown, _type: unknown, id: string) {
    const records = this.loadRecords()
    const data = records.get(id)
    if (!data) throw new Error(`Unknown GUI widget: ${id}`)
    return { data, included: [...records.values()].filter(record => record.id !== id) }
  }
}
