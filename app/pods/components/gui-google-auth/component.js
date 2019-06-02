/* global AGate */

import GuiWindow from '../gui-window'

import { action } from '@ember/object'
import {inject as service} from '@ember/service'

import Url from 'url'

class GuiGoogleAuth extends GuiWindow {
  @service
  google

  authUrl = ``
  onAuthCode = null

  default = {
    type: `google-auth`,
    size: [300, 200]
  }

  /**
   *
   */
  constructor() {
    super(...arguments)
  }

  /**
   *
   */
  didInsertElement() {
    super.didInsertElement(...arguments)
  }

  /**
   *
   * @param url
   * @returns {boolean}
   */
  handleNavigation(url) {
    const query = Url.parse(url, true).query
    if (query) {
      if (query.error) {
        alert(new Error(`There was an error: ${query.error}`))
        return false
      } else if (query.code) {
        // Login is complete
        setImmediate(() => this.onClose())

        // This is the authorization code we need to request tokens
        this.onAuthCodeReceived(query.code)
        return true
      }
    }
  }

  onAuthCodeReceived(code) {
    let onAuthCode = this.get(`onFinish`)
    if (onAuthCode) {
      onAuthCode(code)
    }
  }

  @action
  onBrowserRedirect(e) {
    if (this.handleNavigation(e.url)) {
      e.preventDefault()
    }
  }
}

export default GuiGoogleAuth
