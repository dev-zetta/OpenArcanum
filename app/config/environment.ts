import loadConfigFromMeta from '@embroider/config-meta-loader'
import type { RuntimeConfig } from '../types/runtime'

export interface AppConfig {
  modulePrefix: string
  podModulePrefix?: string
  locationType: 'hash' | 'history' | 'none' | 'auto'
  rootURL: string
  APP?: Record<string, unknown>
  AGate?: RuntimeConfig
}

export default loadConfigFromMeta('open-arcanum') as AppConfig
