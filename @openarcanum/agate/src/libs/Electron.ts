import type {BrowserWindow, BrowserWindowConstructorOptions} from 'electron'
export interface ModalWindowProvider {
  getCurrentWindow(): BrowserWindow
  createWindow(options: BrowserWindowConstructorOptions): BrowserWindow
}
let provider: ModalWindowProvider | undefined
/** Old renderer-side remote windows require an explicit privileged host adapter. */
export default class Electron {
  static configure(next: ModalWindowProvider | undefined): void { provider = next }
  static createModal(options: BrowserWindowConstructorOptions): BrowserWindow {
    if (!provider) throw new Error('Legacy modal windows require an explicitly configured desktop host provider')
    return provider.createWindow({...options, parent: provider.getCurrentWindow(), modal: true})
  }
}
