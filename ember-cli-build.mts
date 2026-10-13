import EmberApp from 'ember-cli/lib/broccoli/ember-app.js'
import { compatBuild } from '@embroider/compat'
import { setConfig } from '@warp-drive/core/build-config'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export default async function (defaults: unknown) {
  const { buildOnce } = await import('@embroider/vite')
  const app = new EmberApp(defaults, {
    hinting: false,
    babel: { plugins: [] },
  })
  // Keep the existing Model/adapter GUI data layer while upgrading WarpDrive.
  setConfig(app, dirname(fileURLToPath(import.meta.url)), {
    compatWith: '5.3',
  })
  return compatBuild(app, buildOnce)
}
