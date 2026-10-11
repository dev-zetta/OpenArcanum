import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
/* global AGate */

import GuiWidget from '../gui-widget'


class GuiWebview extends GuiWidget {
  tagName = 'webview'
  attributeBindings = ['dataId:data-id', 'tooltip:title', 'src']

  default = {
    type: `webview`,
    size: [300, 200]
  }

  src = ``

  onWillNavigate = null
  onLoadingStart = null
  onLoadingStop = null
  onDidNavigate = null

  /*constructor() {
    super(...arguments)
  }*/

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    this.set(`src`, this.get(`authUrl`) || this.get(`url`) || `about:blank`)
  }

  didInsertElement() {
    super.didInsertElement(...arguments)

    // https://github.com/electron/electron/blob/master/docs/api/webview-tag.md
    let webview = this.get(`element`)

    webview.addEventListener(`did-start-loading`, (...args) =>
      this.onLoadingStart?.(...args)
    )
    webview.addEventListener(`did-stop-loading`, (...args) =>
      this.onLoadingStop?.(...args)
    )
    webview.addEventListener(`will-navigate`, (...args) =>
      this.onWillNavigate?.(...args)
    )
    webview.addEventListener(`did-navigate`, (...args) =>
      this.onDidNavigate?.(...args)
    )
    webview.addEventListener(`close`, (...args) => this.onClose(...args))
  }

  isLoading() {
    let webview = this.get(`element`)
    return webview.isLoading()
  }

  loadURL(url, options) {
    let webview = this.get(`element`)
    return webview.loadURL(...arguments)
  }

  onClose() {
    let webview = this.get(`element`)
    webview.src = `about:blank`
  }

  click() {
    return false
  }
}

export default setComponentTemplate(template, GuiWebview)
