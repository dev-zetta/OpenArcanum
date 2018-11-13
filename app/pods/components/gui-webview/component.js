/* global AGate */

import GuiWidget from '../gui-widget'

import { classNames, attribute } from '@ember-decorators/component'
import { tagName } from '@ember-decorators/component'

@tagName(`webview`)
class GuiWebview extends GuiWidget {
  default = {
    type: `webview`,
    size: [300, 200]
  }

  @attribute(`src`)
  src = ``

  onWillNavigate = null

  /*constructor() {
    super(...arguments)
  }*/

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments)

    this.set(`src`, this.get(`url`)) // TODO
  }

  didInsertElement() {
    super.didInsertElement(...arguments)

    // https://github.com/electron/electron/blob/master/docs/api/webview-tag.md
    let webview = this.get(`element`)

    webview.addEventListener(`did-start-loading`, (...args) =>
      this.onLoadingStart(...args)
    )
    webview.addEventListener(`did-stop-loading`, (...args) =>
      this.onLoadingStop(...args)
    )
    webview.addEventListener(`will-navigate`, (...args) =>
      this.onWillNavigate(...args)
    )
    webview.addEventListener(`did-navigate`, (...args) =>
      this.onDidNavigate(...args)
    )
    webview.addEventListener(`close`, (...args) =>
      this.onClose(...args)
    )

  }

  isLoading() {
    let webview = this.get(`element`)
    return webview.isLoading()
  }

  loadURL(url, options) {
    let webview = this.get(`element`)
    return webview.loadURL(...arguments)
  }

  onLoadingStart(e) {
    let callback = this.get('onLoadingStart')
    if (callback) {
      callback(e)
    }
  }

  onLoadingStop(e) {
    let callback = this.get('onLoadingStop')
    if (callback) {
      callback(e)
    }
  }

  onWillNavigate(e) {
    let callback = this.get('onWillNavigate')
    if (callback) {
      callback(e)
    }
  }

  onDidNavigate(e) {
    let callback = this.get('onDidNavigate')
    if (callback) {
      callback(e)
    }
  }

  onClose() {
    let webview = this.get(`element`)
    webview.src = 'about:blank'
  }

  click() {
    return false
  }
}

export default GuiWebview
