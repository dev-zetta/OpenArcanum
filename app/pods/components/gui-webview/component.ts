import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
import GuiWidget from '../gui-widget'
import type { WebviewTag, LoadURLOptions } from 'electron'
import type { WidgetDefinition } from '../../../types/widgets'

class GuiWebview extends GuiWidget {
  tagName = 'webview'
  attributeBindings = ['dataId:data-id', 'tooltip:title', 'src']
  default: WidgetDefinition = { type: 'webview', size: [300, 200] }
  src = ''
  authUrl?: string
  url?: string
  onWillNavigate?: (event: Event) => void
  onLoadingStart?: (event: Event) => void
  onLoadingStop?: (event: Event) => void
  onDidNavigate?: (event: Event) => void
  didReceiveAttrs(): void { super.didReceiveAttrs(); this.set('src', this.authUrl || this.url || 'about:blank') }
  didInsertElement(): this {
    super.didInsertElement()
    const webview = this.element as WebviewTag
    webview.addEventListener('did-start-loading', event => this.onLoadingStart?.(event))
    webview.addEventListener('did-stop-loading', event => this.onLoadingStop?.(event))
    webview.addEventListener('will-navigate', event => this.onWillNavigate?.(event))
    webview.addEventListener('did-navigate', event => this.onDidNavigate?.(event))
    webview.addEventListener('close', () => this.onClose())
    return this
  }
  isLoading(): boolean { return (this.element as WebviewTag).isLoading() }
  loadURL(url: string, options?: LoadURLOptions): Promise<void> { return (this.element as WebviewTag).loadURL(url, options) }
  onClose(): void { (this.element as WebviewTag).src = 'about:blank' }
  click(): boolean { return false }
}
setComponentTemplate(template, GuiWebview)
export default GuiWebview
