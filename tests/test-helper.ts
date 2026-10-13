import 'ember-testing'
import 'qunit/qunit/qunit.css'
import Application from '../app/app'
import config from 'open-arcanum/config/environment'
import { setApplication } from '@ember/test-helpers'
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit'
import { setup } from 'qunit-dom'
import * as QUnit from 'qunit'

export function start(discoveredModuleCount: number) {
  if (discoveredModuleCount === 0) throw new Error('No application test modules were discovered')
  setApplication(Application.create({ ...config.APP }))
  setup(QUnit.assert)
  setupEmberOnerrorValidation()
  const desktop = globalThis.openArcanumDesktop as import('../ember-electron/desktop-contracts.cjs').DesktopBridge | undefined
  desktop?.attachQUnit?.(QUnit as unknown as import('../ember-electron/desktop-contracts.cjs').QUnitBridge)
  qunitStart()
}
