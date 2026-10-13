import type { WidgetDefinition } from '../../../types/widgets'
import { setComponentTemplate } from '@ember/component'
import template from './layout.hbs'
/* global AGate */

import GuiWindow from '../gui-window'

import { action } from '@ember/object'
import { service } from '@ember/service'



class GuiGoogleAuth extends GuiWindow {
  @service
  declare google: import('../../google/service').default

  authUrl = ``
  onAuthCode: ((code: string) => void) | null = null

  default: WidgetDefinition = {
    type: `google-auth`,
    size: [300, 200]
  }

  /**
   *
   */


  /**
   *
   */
  didInsertElement() : this {
    super.didInsertElement()
  
    return this
  }

  /**
   *
   * @param url
   * @returns {boolean}
   */
  handleNavigation(url: string) {
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

  onAuthCodeReceived(code: string) {
    let onAuthCode = this.get(`onAuthCode`)
    if (onAuthCode) {
      onAuthCode(code)
    }
  }

  @action
  onBrowserRedirect(e: Event & { url: string }) {
    if (this.handleNavigation(e.url)) {
      e.preventDefault()
    }
  }
}

setComponentTemplate(template, GuiGoogleAuth)
export default GuiGoogleAuth
