// SPDX-License-Identifier: GPL-3.0-or-later
import { defineScript, flow, defineDataKeys, schemaFromDataKeys, bindDataStore } from '@openarcanum/script-api'

const guideId = 'Inventory workshop/Sector/0/0/Npc/owned-workshop-guide.json'
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const scriptKeys = defineDataKeys({ uses: { default: 0, validate: count } })
const moduleKeys = defineDataKeys({ doorUses: { default: 0, validate: count } })
const playerKeys = defineDataKeys({ doorUses: { default: 0, validate: count } })
const attachmentKeys = defineDataKeys({ uses: { default: 0, validate: count } })

export default defineScript({
  apiVersion: 1,
  id: 'workshop:door',
  name: 'Workshop scripted door',
  realm: 'server',
  dataSchema: schemaFromDataKeys(scriptKeys),
  sharedSchema: schemaFromDataKeys(moduleKeys),
  playerSchema: schemaFromDataKeys(playerKeys),
  attachmentSchema: schemaFromDataKeys(attachmentKeys),
  entryPoints: {
    0(ctx) {
      ctx.at(0, 'workshop-door-use')
      const firstUse = ctx.number(ctx.attachment.counter(0)) === 0
      ctx.attachment.counter(0).value = Math.min(255, ctx.number(ctx.attachment.counter(0)) + 1)
      const data = bindDataStore(ctx.data, scriptKeys)
      const shared = bindDataStore(ctx.shared.data, moduleKeys)
      const player = bindDataStore(ctx.player.data, playerKeys)
      const attachment = bindDataStore(ctx.attachment.data, attachmentKeys)
      data.set('uses', data.get('uses') + 1)
      shared.set('doorUses', shared.get('doorUses') + 1)
      player.set('doorUses', player.get('doorUses') + 1)
      attachment.set('uses', attachment.get('uses') + 1)
      ctx.shared.variable(0).value = ctx.number(ctx.shared.variable(0)) + 1
      if (firstUse) {
        ctx.game.toggleOff({ id: guideId }, true)
        ctx.ui.message('The scripted door refuses the first use. The guide is hidden until you use it again.', ctx.attachee?.id)
        ctx.game.schedule('workshop:door', 8, 10, {
          triggererId: ctx.triggerer?.id ?? null, attacheeId: ctx.attachee?.id ?? null,
          playerId: ctx.playerObject?.id ?? null
        })
        return flow.skipDefault()
      }
      ctx.game.toggleOff({ id: guideId }, false)
      ctx.ui.message('The scripted door permits its normal action. The guide is visible again.', ctx.attachee?.id)
      return flow.runDefault()
    },
    10(ctx) {
      ctx.at(10, 'workshop-idle-message')
      ctx.ui.message('The delayed workshop script ran while the world was idle.', ctx.attachee?.id)
      return flow.skipDefault()
    }
  }
})
