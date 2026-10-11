import 'ember-testing'
import 'qunit/qunit/qunit.css'
import Application from '../app/app'
import config from 'open-arcanum/config/environment'
import { setApplication } from '@ember/test-helpers'
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit'
import { setup } from 'qunit-dom'
import * as QUnit from 'qunit'

export function start() {
  setApplication(Application.create(config.APP))
  setup(QUnit.assert)
  setupEmberOnerrorValidation()
  globalThis.openArcanumDesktop?.attachQUnit(QUnit)
  qunitStart()
}
