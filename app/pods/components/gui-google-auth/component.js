import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
/* global AGate */

import GuiWindow from '../gui-window'

import { action } from '@ember/object'
import { service } from '@ember/service'



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
    const query = Object.fromEntries(new URL(url).searchParams)
    if (query) {
      if (query.error) {
        alert(new Error(`There was an error: ${query.error}`))
        return false
      } else if (query.code) {
        // Login is complete
        setTimeout(() => this.hide(), 0)

        // This is the authorization code we need to request tokens
        this.onAuthCodeReceived(query.code)
        return true
      }
    }
  }

  onAuthCodeReceived(code) {
    let onAuthCode = this.get(`onAuthCode`)
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

export default setComponentTemplate(template, GuiGoogleAuth)
