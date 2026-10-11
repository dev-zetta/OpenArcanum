import Adapter from '@ember-data/adapter'
import { getAGate } from 'open-arcanum/lib/runtime'

// GUI definitions are authored JavaScript loaded locally, not a mock HTTP API.
export default class ApplicationAdapter extends Adapter {
  records = null

  loadRecords() {
    if (this.records) return this.records
    const runtime = getAGate()
    if (!runtime) throw new Error('Local GUI scripts require the desktop runtime.')
    const definitions = new Map()
    runtime.Utils.loadScripts('client/gui', (name, definition) => definitions.set(name, definition))
    for (const [name, definition] of definitions) {
      if (definition.parent) {
        const parent = definitions.get(definition.parent)
        if (!parent) throw new Error(`GUI definition ${name} references missing parent ${definition.parent}.`)
        parent.components ||= {}
        parent.components[name] = definition
      }
    }
    const records = new Map()
    const visit = (id, definition, parent = null) => {
      const { components = {}, parent: _parent, ...attributes } = definition
      const children = Object.entries(components || {})
      records.set(id, {
        type: 'gui-widget', id,
        attributes,
        relationships: {
          parent: { data: parent ? { type: 'gui-widget', id: parent } : null },
          components: { data: children.map(([id]) => ({ type: 'gui-widget', id })) }
        }
      })
      for (const [childId, child] of children) visit(childId, child, id)
    }
    for (const [id, definition] of definitions) if (!definition.parent) visit(id, definition)
    this.records = records
    return records
  }

  async query(_store, _type, query) {
    const records = [...this.loadRecords().values()]
    const data = records.filter(record => Object.entries(query.filter || {}).every(([key, value]) => record.attributes[key] === value))
    return { data, included: records.filter(record => !data.includes(record)) }
  }

  async findRecord(_store, _type, id) {
    const records = this.loadRecords()
    if (!records.has(id)) throw new Error(`Unknown GUI widget: ${id}`)
    return { data: records.get(id), included: [...records.values()].filter(record => record.id !== id) }
  }
}
