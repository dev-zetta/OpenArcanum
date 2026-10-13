// SPDX-License-Identifier: GPL-3.0-or-later
import { defineScript, flow, defineDataKeys, schemaFromDataKeys, bindDataStore } from '@openarcanum/script-api'

const keys = defineDataKeys({ messages: { default: 0, validate(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
} } })

export default defineScript({
  apiVersion: 1,
  id: 'workshop:presentation',
  name: 'Workshop private messages',
  realm: 'client',
  dataSchema: schemaFromDataKeys(keys),
  entryPoints: {
    0(ctx) {
      ctx.at(0, 'private-message')
      if (ctx.event.type !== 'message' || typeof ctx.event.text !== 'string') throw new Error('Unsupported workshop presentation')
      const data = bindDataStore(ctx.data, keys)
      data.set('messages', data.get('messages') + 1)
      ctx.ui.message(ctx.event.text, typeof ctx.event.targetId === 'string' ? ctx.event.targetId : undefined)
      return flow.skipDefault()
    }
  }
})
