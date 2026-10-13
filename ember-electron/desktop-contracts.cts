import type { createRequire } from 'node:module'
import type { LocalServerState, LocalSessionDescriptor } from './local-server.cjs'

/** Resolved configuration from config/project.js, shared with the renderer. */
export interface ProjectConfig {
  dataPath: string
  scriptsPath: string
  appProtocol: string
  client: { serverURL: string }
  server: { listenPort: number }
  moduleId?: 'inventory-workshop'
  authoredGui?: boolean
  developmentMap?: string
  moduleManifestPath?: string
  checkpointPath?: string
}

export interface QUnitTestCounts {
  passed: number
  failed: number
  skipped: number
  todo: number
  total: number
}

export interface QUnitAssertion {
  result: boolean
  name?: string
  module?: string
  message?: string
  actual?: unknown
  expected?: unknown
  source?: string
}

/** Only the QUnit hooks consumed by the desktop assertion reporter. */
export interface QUnitBridge {
  on(event: 'runEnd', callback: (details: { testCounts: QUnitTestCounts }) => void): void
  log(callback: (details: QUnitAssertion) => void): void
  done(callback: (details: { passed: number; failed: number; total: number; runtime: number }) => void): void
}

export interface DesktopBridge {
  readonly config: ProjectConfig
  readonly compatibilityMode: true
  readonly attachQUnit: (qunit: QUnitBridge) => void
  readonly startLocalServer: (requestId: string) => Promise<LocalSessionDescriptor>
  readonly stopLocalServer: (requestId: string) => Promise<LocalServerState>
  readonly getLocalServerState: () => Promise<LocalServerState>
  readonly platform: NodeJS.Platform
  readonly versions: Readonly<{ electron: string | undefined; node: string }>
}

export type NodeRequireBridge = ReturnType<typeof createRequire>

export type LocalSessionReply =
  | { ok: true; session: LocalSessionDescriptor }
  | { ok: false; message: string }

export function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
}

export function errorStack(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'stack' in error && error.stack ? String(error.stack) : undefined
}
