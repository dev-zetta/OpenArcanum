import 'node:module'
/** The in-memory esbuild harness deliberately uses these stable Node internals. */
declare global {
  namespace NodeJS {
    interface Module {
      _compile(source: string, filename: string): void
    }
  }
}
declare module 'module' {
  namespace Module {
    function _nodeModulePaths(from: string): string[]
  }
}
